# /kadai-run

Invoke the `kadai-runner` skill to autonomously execute the picked story's plan, with fast-follow-up unblocking when needed.

## Usage

```
/kadai-run            # start (or resume) the runner
/kadai-run status     # just print current state, do nothing
```

## What happens

The runner reads the picked story, walks each `### Task N` in its plan, dispatches an implementer subagent per task with spec + code-quality reviews. Pauses at story boundaries for human confirmation; pauses with escalation if a story needs a fast-follow-up feature to unblock.

State persists in `.kadai/runner.json` — re-run `/kadai-run` after a crash to pick up where you left off.

See the `kadai-runner` skill for the full state model + fast-follow-up flow.
