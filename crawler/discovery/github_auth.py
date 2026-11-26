"""Bridge an explicitly passed, profile-owned token to the GitHub CLI only."""
import os


def github_env():
    env = dict(os.environ)
    token = env.get("BABYROO_GITHUB_TOKEN", "").strip()
    if token:
        env["GH_TOKEN"] = token
    env["GH_PROMPT_DISABLED"] = "1"
    return env
