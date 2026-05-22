{
  "version": 1,
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "timeoutMs": 2000,
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/hooks/codex-hook.mjs SessionStart"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "timeoutMs": 2000,
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/hooks/codex-hook.mjs UserPromptSubmit"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "*",
        "timeoutMs": 2000,
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/hooks/codex-hook.mjs PreToolUse"
          }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "matcher": "*",
        "timeoutMs": 2000,
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/hooks/codex-hook.mjs PermissionRequest"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "timeoutMs": 2000,
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/hooks/codex-hook.mjs PostToolUse"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "timeoutMs": 2000,
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/hooks/codex-hook.mjs Stop"
          }
        ]
      }
    ]
  }
}
