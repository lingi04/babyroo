"""Use one profile-owned GitHub credential for gh and HTTPS Git operations."""
import os
import re
from urllib.parse import urlsplit


def github_env():
    env = dict(os.environ)
    token = env.get("BABYROO_GITHUB_TOKEN", "").strip()
    if token:
        env["GH_TOKEN"] = token
    env["GH_PROMPT_DISABLED"] = "1"
    env["GIT_TERMINAL_PROMPT"] = "0"
    # Scoped to this child process; do not change the account's global Git config.
    options = [("credential.helper", ""),
               ("credential.https://github.com.helper", ""),
               ("credential.https://github.com.helper", "!gh auth git-credential"),
               ("url.https://github.com/.insteadOf", "git@github.com:"),
               ("url.https://github.com/.insteadOf", "ssh://git@github.com/")]
    count = int(env.get("GIT_CONFIG_COUNT", "0"))
    if count < 0:
        raise ValueError("invalid GIT_CONFIG_COUNT")
    for key, value in options:
        env[f"GIT_CONFIG_KEY_{count}"] = key
        env[f"GIT_CONFIG_VALUE_{count}"] = value
        count += 1
    env["GIT_CONFIG_COUNT"] = str(count)
    env["GIT_SSH_COMMAND"] = "false"  # No implicit SSH fallback.
    return env


def github_repository(value):
    """Canonical OWNER/REPO; legacy SSH input is converted, never contacted via SSH."""
    if value.startswith("git@github.com:"):
        value = value[len("git@github.com:"):]
    elif value.startswith("ssh://git@github.com/"):
        value = value[len("ssh://git@github.com/"):]
    elif "://" in value:
        url = urlsplit(value)
        if url.scheme != "https" or url.netloc != "github.com" or url.query or url.fragment:
            raise ValueError("repository must be a github.com HTTPS URL or OWNER/REPO")
        value = url.path.lstrip("/")
    value = value.removesuffix(".git")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+", value):
        raise ValueError("repository must identify exactly one GitHub OWNER/REPO")
    return value


def github_url(value):
    return "https://github.com/" + github_repository(value) + ".git"
