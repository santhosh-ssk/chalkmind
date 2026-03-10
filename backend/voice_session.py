"""Voice session manager — tracks narration progress through lesson steps with quiz support."""

import logging
import os

logger = logging.getLogger(__name__)

QUIZ_TIMER_SECONDS = int(os.getenv("QUIZ_TIMER_SECONDS", "6"))


class VoiceSession:
    """Tracks narration/quiz state machine through lesson steps.

    States: NARRATING | QUIZ_INTRO | QUIZ_READING | QUIZ_WAITING | QUIZ_REVEAL | COMPLETE
    """

    def __init__(self, lesson_data: dict):
        self.lesson_data = lesson_data
        self.steps = lesson_data.get("steps", [])
        self.total_steps = len(self.steps)
        self.current_step = -1  # Not started yet
        self.quizzes = {q["scene"]: q for q in lesson_data.get("quizzes", [])}

        # State machine
        self.state = "NARRATING"

        # Quiz tracking
        self.current_quiz_scene = -1
        self.current_quiz_question_idx = 0
        self.quiz_answers = []  # All answers across all scenes
        self.current_scene_answers = []  # Answers for current scene quiz

        # Precompute last step index per scene for O(1) lookup
        self._scene_last_step = {}
        for i, step in enumerate(self.steps):
            self._scene_last_step[step.get("scene", 0)] = i

    def _has_quiz_for_scene(self, scene: int) -> bool:
        return scene in self.quizzes

    def _get_current_quiz(self):
        return self.quizzes.get(self.current_quiz_scene)

    def get_initial_prompt(self) -> str:
        """Return the prompt that kicks off narration (step 0)."""
        if self.total_steps == 0:
            return "There are no steps to narrate."
        self.current_step = 0
        step = self.steps[0]
        return (
            f"Now narrate step 0: {step['narration']}\n"
            f"Scene: {step.get('scene_title', '')}"
        )

    def on_turn_complete(self) -> dict | None:
        """Called when the agent finishes speaking (turn_complete event).

        Returns dict with 'action' key indicating what to do next:
        - {'action': 'advance_step', 'step': N, 'prompt': str}
        - {'action': 'start_quiz', 'scene': N, 'questions': [...], 'prompt': str}
        - {'action': 'quiz_question', 'scene': N, 'question_index': N, 'prompt': str}
        - {'action': 'quiz_question_ready', 'scene': N, 'question_index': N}
        - {'action': 'quiz_reveal_done', 'next_action': dict|None}
        - {'action': 'complete'}
        - None → should not happen
        """
        if self.state == "NARRATING":
            return self._on_narrating_turn_complete()
        elif self.state == "QUIZ_INTRO":
            return self._on_quiz_intro_complete()
        elif self.state == "QUIZ_READING":
            return self._on_quiz_reading_complete()
        elif self.state == "QUIZ_REVEAL":
            return self._on_quiz_reveal_complete()
        return None

    def _on_narrating_turn_complete(self) -> dict | None:
        """Handle turn_complete during narration state."""
        current_scene = self.steps[self.current_step].get("scene", 0) if self.current_step >= 0 else -1
        is_last_step_of_scene = (self.current_step == self._scene_last_step.get(current_scene, -1))

        # Check if we should start a quiz
        if is_last_step_of_scene and self._has_quiz_for_scene(current_scene):
            self.state = "QUIZ_INTRO"
            self.current_quiz_scene = current_scene
            self.current_quiz_question_idx = 0
            self.current_scene_answers = []

            quiz = self._get_current_quiz()
            questions = quiz["questions"]
            scene_title = quiz.get("scene_title", f"Scene {current_scene + 1}")

            # Build questions context for the agent
            q_context = self._build_questions_context(questions)

            prompt = (
                f"You just finished teaching {scene_title}. Now introduce a quick quiz.\n"
                f"Say something brief like: \"Let's see what you've learned so far! I have 3 quick questions for you.\"\n"
                f"Then STOP. Do NOT read the first question yet.\n\n"
                f"QUIZ QUESTIONS (for your reference):\n{q_context}"
            )

            logger.info("Starting quiz for scene %d (%s)", current_scene, scene_title)
            return {
                "action": "start_quiz",
                "scene": current_scene,
                "questions": questions,
                "prompt": prompt,
            }

        # Normal step advancement
        next_step = self.current_step + 1
        if next_step >= self.total_steps:
            self.state = "COMPLETE"
            logger.info("Narration complete (all %d steps done)", self.total_steps)
            return {"action": "complete"}

        self.current_step = next_step
        step = self.steps[next_step]
        prompt = (
            f"Now narrate step {next_step}: {step['narration']}\n"
            f"Scene: {step.get('scene_title', '')}"
        )
        logger.info("Advancing to step %d/%d", next_step, self.total_steps)
        return {
            "action": "advance_step",
            "step": next_step,
            "prompt": prompt,
        }

    def _on_quiz_intro_complete(self) -> dict:
        """Agent finished quiz intro → start reading Q0."""
        self.state = "QUIZ_READING"
        quiz = self._get_current_quiz()
        q = quiz["questions"][0]
        prompt = self._build_read_question_prompt(q, 0)

        logger.info("Quiz intro done, reading Q0 for scene %d", self.current_quiz_scene)
        return {
            "action": "quiz_question",
            "scene": self.current_quiz_scene,
            "question_index": 0,
            "prompt": prompt,
        }

    def _on_quiz_reading_complete(self) -> dict:
        """Agent finished reading a question → enter WAITING state."""
        self.state = "QUIZ_WAITING"
        logger.info("Q%d read, waiting for answer (scene %d)",
                     self.current_quiz_question_idx, self.current_quiz_scene)
        return {
            "action": "quiz_question_ready",
            "scene": self.current_quiz_scene,
            "question_index": self.current_quiz_question_idx,
        }

    def _on_quiz_reveal_complete(self) -> dict:
        """Agent finished batch reveal → advance to next scene or complete."""
        # Flush current scene answers to global list
        self.quiz_answers.extend(self.current_scene_answers)
        self.current_scene_answers = []
        self.state = "NARRATING"

        # Advance to next scene step
        next_step = self.current_step + 1
        if next_step >= self.total_steps:
            self.state = "COMPLETE"
            logger.info("Quiz reveal done + narration complete")
            return {
                "action": "quiz_reveal_done",
                "next_action": {"action": "complete"},
            }

        self.current_step = next_step
        step = self.steps[next_step]
        prompt = (
            f"Now narrate step {next_step}: {step['narration']}\n"
            f"Scene: {step.get('scene_title', '')}"
        )
        logger.info("Quiz reveal done, advancing to step %d", next_step)
        return {
            "action": "quiz_reveal_done",
            "next_action": {
                "action": "advance_step",
                "step": next_step,
                "prompt": prompt,
            },
        }

    def on_quiz_answer(self, selected: str | None) -> dict:
        """Handle a quiz answer from the user.

        Returns:
        - {'action': 'next_question', 'prompt': str} → more questions to ask
        - {'action': 'batch_reveal', 'answers': [...], 'prompt': str} → all answered, reveal
        """
        if self.state != "QUIZ_WAITING":
            logger.warning("on_quiz_answer called in state %s, ignoring", self.state)
            return {"action": "ignored"}

        quiz = self._get_current_quiz()
        q = quiz["questions"][self.current_quiz_question_idx]
        is_correct = selected == q["correct"] if selected else False

        answer = {
            "scene": self.current_quiz_scene,
            "question_index": self.current_quiz_question_idx,
            "selected": selected,
            "correct": q["correct"],
            "is_correct": is_correct,
        }
        self.current_scene_answers.append(answer)
        logger.info("Quiz answer: scene=%d Q%d selected=%s correct=%s",
                     self.current_quiz_scene, self.current_quiz_question_idx,
                     selected, q["correct"])

        next_q_idx = self.current_quiz_question_idx + 1
        if next_q_idx < len(quiz["questions"]):
            # More questions
            self.current_quiz_question_idx = next_q_idx
            self.state = "QUIZ_READING"
            next_q = quiz["questions"][next_q_idx]
            prompt = self._build_read_question_prompt(next_q, next_q_idx)
            return {
                "action": "next_question",
                "scene": self.current_quiz_scene,
                "question_index": next_q_idx,
                "prompt": prompt,
            }

        # All 3 answered → batch reveal
        self.state = "QUIZ_REVEAL"
        prompt = self._build_reveal_prompt(quiz["questions"])
        return {
            "action": "batch_reveal",
            "answers": self.current_scene_answers.copy(),
            "prompt": prompt,
        }

    def get_quiz_results(self) -> dict | None:
        """Get aggregate quiz results after all quizzes are done."""
        all_answers = self.quiz_answers + self.current_scene_answers
        if not all_answers:
            return None

        total = len(all_answers)
        correct = sum(1 for a in all_answers if a["is_correct"])
        score = round((correct / total) * 100) if total > 0 else 0

        # Per-scene breakdown
        scene_map = {}
        for a in all_answers:
            si = a["scene"]
            if si not in scene_map:
                quiz = self.quizzes.get(si, {})
                scene_map[si] = {
                    "scene": si,
                    "scene_title": quiz.get("scene_title", f"Scene {si + 1}"),
                    "correct": 0,
                    "total": 0,
                }
            scene_map[si]["total"] += 1
            if a["is_correct"]:
                scene_map[si]["correct"] += 1

        return {
            "total_questions": total,
            "correct_count": correct,
            "score": score,
            "passed": score >= 70,
            "per_scene": list(scene_map.values()),
            "answers": all_answers,
        }

    def _build_questions_context(self, questions: list) -> str:
        parts = []
        for i, q in enumerate(questions):
            opts = " | ".join(f"{o['label']}: {o['text']}" for o in q["options"])
            parts.append(f"Q{i+1}: {q['question']}\n  {opts}\n  Answer: {q['correct']}")
        return "\n".join(parts)

    def _build_read_question_prompt(self, question: dict, idx: int) -> str:
        opts = "\n".join(f"  {o['label']}: {o['text']}" for o in question["options"])
        return (
            f"Read question {idx + 1} aloud:\n"
            f"\"{question['question']}\"\n"
            f"Options:\n{opts}\n\n"
            f"After reading all options, say \"You have {QUIZ_TIMER_SECONDS} seconds\" and STOP.\n"
            f"Do NOT reveal the answer."
        )

    def _build_reveal_prompt(self, questions: list) -> str:
        parts = ["Reveal the answers for all 3 questions:"]
        for i, answer in enumerate(self.current_scene_answers):
            q = questions[i]
            if answer["is_correct"]:
                parts.append(f"Question {i+1}: Correct! The answer is {q['correct']}: "
                           f"{next(o['text'] for o in q['options'] if o['label'] == q['correct'])}. "
                           f"{q.get('explanation', '')}")
            else:
                selected_text = "no answer"
                if answer["selected"]:
                    selected_text = next(
                        (o['text'] for o in q['options'] if o['label'] == answer['selected']),
                        answer['selected']
                    )
                correct_text = next(o['text'] for o in q['options'] if o['label'] == q['correct'])
                parts.append(f"Question {i+1}: Not quite — you said {selected_text}, "
                           f"but the answer is {q['correct']}: {correct_text}. "
                           f"{q.get('explanation', '')}")

        correct_count = sum(1 for a in self.current_scene_answers if a["is_correct"])
        parts.append(f"\nOverall: {correct_count} out of 3 correct.")
        parts.append("Keep it brief and encouraging. Then STOP.")
        return "\n".join(parts)
