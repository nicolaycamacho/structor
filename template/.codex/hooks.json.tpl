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
            "command": "node scripts/hooks/codex-hook.mjs SessionStart --json"
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
            "command": "node scripts/hooks/codex-hook.mjs UserPromptSubmit --json"
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
            "command": "node scripts/hooks/codex-hook.mjs PreToolUse --json"
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
            "command": "node scripts/hooks/codex-hook.mjs PermissionRequest --json"
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
            "command": "node scripts/hooks/codex-hook.mjs PostToolUse --json"
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
            "command": "node scripts/hooks/codex-hook.mjs Stop --json"
          }
        ]
      }
    ]
  }
}
