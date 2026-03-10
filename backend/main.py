"""ChalkMind FastAPI backend — health check, lesson generation, voice WebSocket, + static file serving."""

import asyncio
import json
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from slowapi.errors import RateLimitExceeded

from backend.config import RECAPTCHA_ENABLED
from backend.lesson_generator import generate_lesson
from backend.middleware.cors import setup_cors
from backend.middleware.rate_limiter import limiter, rate_limit_exceeded_handler, GENERATE_LESSON_LIMIT
from backend.models.requests import LessonRequest
from backend.observability import create_trace, trace_agent_call, flush as flush_traces
from backend.security.recaptcha import verify_recaptcha
from backend.security.sanitizer import sanitize_input
from backend.voice_agent import create_narration_agent
from backend.voice_session import VoiceSession

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")

app = FastAPI(title="ChalkMind API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
setup_cors(app)


@app.get("/api/health")
async def health():
    return {"status": "healthy"}


@app.post("/api/generate-lesson")
@limiter.limit(GENERATE_LESSON_LIMIT)
async def generate_lesson_endpoint(request: Request, body: LessonRequest):
    logger.info(">>> /api/generate-lesson called: topic=%s name=%s age=%s diff=%s recaptcha=%s",
                body.topic, body.name, body.age_group, body.difficulty, bool(body.recaptcha_token))
    try:
        # Layer 2: reCAPTCHA verification
        logger.info("  [1] Verifying reCAPTCHA (enabled=%s)...", RECAPTCHA_ENABLED)
        await verify_recaptcha(body.recaptcha_token)
        logger.info("  [1] reCAPTCHA OK")

        # Layer 4-5: Sanitize topic (profanity + injection check)
        logger.info("  [2] Sanitizing inputs...")
        sanitized_topic = sanitize_input(body.topic)
        sanitized_name = sanitize_input(body.name)
        logger.info("  [2] Sanitized: topic=%s name=%s", sanitized_topic, sanitized_name)

        # Create observability trace
        trace = create_trace("generate-lesson", metadata={
            "topic": sanitized_topic,
            "name": sanitized_name,
            "age_group": body.age_group,
            "difficulty": body.difficulty,
        })

        # Generate lesson with personalization
        logger.info("  [3] Starting lesson generation...")
        lesson = await generate_lesson(
            topic=sanitized_topic,
            name=sanitized_name,
            age_group=body.age_group,
            difficulty=body.difficulty,
            trace=trace,
        )
        logger.info("  [3] Lesson generated successfully, %d steps", len(lesson.get("steps", [])))
        flush_traces()
        return lesson
    except HTTPException as e:
        logger.warning("  HTTPException: %s %s", e.status_code, e.detail)
        raise
    except ValueError as e:
        logger.error("  ValueError: %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("  Unexpected error: %s", e)
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


# ── Voice WebSocket ──────────────────────────────────────────────
_voice_session_service = InMemorySessionService()
VOICE_APP_NAME = "chalkmind-voice"


@app.websocket("/ws/voice/{session_id}")
async def voice_websocket(websocket: WebSocket, session_id: str):
    import time as _time

    await websocket.accept()
    logger.info("Voice WS connected: session=%s", session_id)
    session_start_ts = _time.time()

    # Tracing
    trace = create_trace("voice-session", metadata={"session_id": session_id})

    # Wait for start_lesson message
    try:
        first_msg = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        data = json.loads(first_msg)
        if data.get("type") != "start_lesson" or not data.get("lesson"):
            await websocket.send_text(json.dumps({"type": "error", "message": "Expected start_lesson message"}))
            await websocket.close()
            return
    except (asyncio.TimeoutError, json.JSONDecodeError) as e:
        logger.error("Voice WS init error: %s", e)
        trace_agent_call(trace, "voice-init", "start_lesson", "", 0, error=str(e))
        flush_traces()
        await websocket.close()
        return

    lesson_data = data["lesson"]
    total_steps = len(lesson_data.get("steps", []))
    voice_session = VoiceSession(lesson_data)

    # Lock for voice_session state mutations (both tasks modify state)
    session_lock = asyncio.Lock()

    # Create agent + runner for this session
    agent_create_ts = _time.time()
    agent = create_narration_agent(lesson_data)
    runner = Runner(
        app_name=VOICE_APP_NAME, agent=agent, session_service=_voice_session_service
    )

    user_id = f"voice-{session_id}"
    await _voice_session_service.create_session(
        app_name=VOICE_APP_NAME, user_id=user_id, session_id=session_id
    )
    agent_create_ms = (_time.time() - agent_create_ts) * 1000
    logger.info("Voice agent created in %.0fms (steps=%d)", agent_create_ms, total_steps)
    trace_agent_call(
        trace, "voice-agent-init", f"lesson: {lesson_data.get('title', '')}", f"{total_steps} steps",
        agent_create_ms, metadata={"total_steps": total_steps},
    )

    # No mic input — disable VAD, narration-only mode
    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Kore",
                )
            ),
        ),
        realtime_input_config=types.RealtimeInputConfig(
            automatic_activity_detection=types.AutomaticActivityDetection(
                disabled=True,
            ),
        ),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        session_resumption=types.SessionResumptionConfig(),
    )

    live_request_queue = LiveRequestQueue()

    # Send initial prompt to kick off narration
    initial_prompt = voice_session.get_initial_prompt()
    live_request_queue.send_content(
        types.Content(parts=[types.Part(text=initial_prompt)])
    )
    # Tell frontend we're starting step 0
    await websocket.send_text(json.dumps({"type": "advance_step", "step": 0}))

    # Track per-step timing
    step_start_ts = _time.time()

    async def upstream_task():
        """Client -> Server: handle text input and quiz answers."""
        try:
            while True:
                message = await websocket.receive()
                if "text" in message:
                    msg_data = json.loads(message["text"])
                    msg_type = msg_data.get("type")

                    if msg_type == "text_input":
                        content = types.Content(
                            parts=[types.Part(text=msg_data["text"])],
                        )
                        live_request_queue.send_content(content)

                    elif msg_type == "quiz_answer":
                        selected = msg_data.get("selected")  # string or null
                        async with session_lock:
                            result = voice_session.on_quiz_answer(selected)

                        action = result.get("action")
                        if action == "next_question":
                            # Send next question event to frontend + prompt to agent
                            await websocket.send_text(json.dumps({
                                "type": "quiz_question",
                                "scene": result["scene"],
                                "question_index": result["question_index"],
                            }))
                            live_request_queue.send_content(
                                types.Content(parts=[types.Part(text=result["prompt"])])
                            )
                            trace_agent_call(
                                trace, f"quiz-answer-{msg_data.get('question_index', '?')}",
                                f"selected={selected}", f"next_question",
                                0, metadata={"scene": result.get("scene")},
                            )

                        elif action == "batch_reveal":
                            # Send results to frontend + reveal prompt to agent
                            await websocket.send_text(json.dumps({
                                "type": "quiz_results",
                                "scene": voice_session.current_quiz_scene,
                                "answers": result["answers"],
                            }))
                            live_request_queue.send_content(
                                types.Content(parts=[types.Part(text=result["prompt"])])
                            )
                            trace_agent_call(
                                trace, "quiz-reveal",
                                f"scene={voice_session.current_quiz_scene}",
                                json.dumps(result["answers"]),
                                0, metadata={"scene": voice_session.current_quiz_scene},
                            )

        except WebSocketDisconnect:
            logger.info("Voice client disconnected (upstream)")

    async def downstream_task():
        """Gemini -> Client: iterate events, send audio/text, advance steps on turn_complete."""
        nonlocal step_start_ts
        try:
            async for event in runner.run_live(
                user_id=user_id,
                session_id=session_id,
                live_request_queue=live_request_queue,
                run_config=run_config,
            ):
                if event.interrupted:
                    logger.info("Voice: INTERRUPTED")
                    await websocket.send_text(json.dumps({"type": "interrupted"}))

                if event.turn_complete:
                    step_ms = (_time.time() - step_start_ts) * 1000
                    logger.info("Voice: TURN COMPLETE (step %d, state=%s, %.0fms)",
                                voice_session.current_step, voice_session.state, step_ms)
                    await websocket.send_text(json.dumps({"type": "turn_complete"}))

                    trace_agent_call(
                        trace, f"narrate-step-{voice_session.current_step}",
                        f"step {voice_session.current_step}/{total_steps} state={voice_session.state}",
                        "turn_complete", step_ms,
                        metadata={"step": voice_session.current_step, "state": voice_session.state},
                    )

                    # Process turn_complete through state machine
                    async with session_lock:
                        result = voice_session.on_turn_complete()

                    if result is None:
                        continue

                    action = result.get("action")
                    step_start_ts = _time.time()

                    if action == "advance_step":
                        await websocket.send_text(
                            json.dumps({"type": "advance_step", "step": result["step"]})
                        )
                        live_request_queue.send_content(
                            types.Content(parts=[types.Part(text=result["prompt"])])
                        )

                    elif action == "start_quiz":
                        await websocket.send_text(json.dumps({
                            "type": "start_quiz",
                            "scene": result["scene"],
                            "questions": result["questions"],
                        }))
                        live_request_queue.send_content(
                            types.Content(parts=[types.Part(text=result["prompt"])])
                        )
                        trace_agent_call(
                            trace, f"quiz-start-scene-{result['scene']}",
                            f"scene {result['scene']}", "start_quiz",
                            0, metadata={"scene": result["scene"]},
                        )

                    elif action == "quiz_question":
                        await websocket.send_text(json.dumps({
                            "type": "quiz_question",
                            "scene": result["scene"],
                            "question_index": result["question_index"],
                        }))
                        live_request_queue.send_content(
                            types.Content(parts=[types.Part(text=result["prompt"])])
                        )

                    elif action == "quiz_question_ready":
                        await websocket.send_text(json.dumps({
                            "type": "quiz_question_ready",
                            "scene": result["scene"],
                            "question_index": result["question_index"],
                        }))

                    elif action == "quiz_reveal_done":
                        next_action = result.get("next_action")
                        if next_action and next_action.get("action") == "complete":
                            total_ms = (_time.time() - session_start_ts) * 1000
                            quiz_results = voice_session.get_quiz_results()
                            logger.info("Voice: NARRATION+QUIZ COMPLETE (total %.0fms)", total_ms)
                            trace_agent_call(
                                trace, "voice-session-complete",
                                f"{total_steps} steps", "narration_complete", total_ms,
                                metadata={
                                    "total_steps": total_steps,
                                    "quiz_score": quiz_results.get("score") if quiz_results else None,
                                },
                            )
                            flush_traces()
                            await websocket.send_text(json.dumps({
                                "type": "narration_complete",
                                "quiz_results": quiz_results,
                            }))
                        elif next_action and next_action.get("action") == "advance_step":
                            await websocket.send_text(
                                json.dumps({"type": "advance_step", "step": next_action["step"]})
                            )
                            live_request_queue.send_content(
                                types.Content(parts=[types.Part(text=next_action["prompt"])])
                            )

                    elif action == "complete":
                        total_ms = (_time.time() - session_start_ts) * 1000
                        quiz_results = voice_session.get_quiz_results()
                        logger.info("Voice: NARRATION COMPLETE (total %.0fms)", total_ms)
                        trace_agent_call(
                            trace, "voice-session-complete",
                            f"{total_steps} steps", "narration_complete", total_ms,
                            metadata={
                                "total_steps": total_steps,
                                "quiz_score": quiz_results.get("score") if quiz_results else None,
                            },
                        )
                        flush_traces()
                        await websocket.send_text(json.dumps({
                            "type": "narration_complete",
                            "quiz_results": quiz_results,
                        }))

                if not event.content or not event.content.parts:
                    continue

                for part in event.content.parts:
                    if part.inline_data and part.inline_data.mime_type.startswith("audio/pcm"):
                        await websocket.send_bytes(part.inline_data.data)
                    elif part.text:
                        role = event.content.role if event.content.role else "model"
                        await websocket.send_text(
                            json.dumps({"type": "transcript", "role": role, "text": part.text})
                        )
        except WebSocketDisconnect:
            logger.info("Voice client disconnected (downstream)")

    try:
        await asyncio.gather(upstream_task(), downstream_task())
    except Exception:
        logger.exception("Voice session error")
        trace_agent_call(trace, "voice-session-error", session_id, "", 0, error="session_exception")
        flush_traces()
    finally:
        live_request_queue.close()
        logger.info("Voice session closed: %s", session_id)


# Serve frontend static files (must be last — catches all paths for SPA routing)
frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")
