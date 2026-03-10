"""Voice session manager — tracks narration progress through lesson steps."""

import logging

logger = logging.getLogger(__name__)


class VoiceSession:
    """Tracks which step the narration agent is on and decides what to do on turn_complete."""

    def __init__(self, lesson_data: dict):
        self.lesson_data = lesson_data
        self.steps = lesson_data.get("steps", [])
        self.total_steps = len(self.steps)
        self.current_step = -1  # Not started yet

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

        Returns:
            - dict with advance_step message + next prompt, or
            - None if narration is complete
        """
        next_step = self.current_step + 1

        if next_step >= self.total_steps:
            logger.info("Narration complete (all %d steps done)", self.total_steps)
            return None

        self.current_step = next_step
        step = self.steps[next_step]
        prompt = (
            f"Now narrate step {next_step}: {step['narration']}\n"
            f"Scene: {step.get('scene_title', '')}"
        )

        logger.info("Advancing to step %d/%d", next_step, self.total_steps)
        return {
            "advance_step": next_step,
            "prompt": prompt,
        }
