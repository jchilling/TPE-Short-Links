#!/usr/bin/env python3
"""Extract words from utils.py and add acronyms/swear words to blocked_words.txt"""

import re
from pathlib import Path

# Read utils.py
utils_path = Path(__file__).parent.parent / "app" / "utils.py"
content = utils_path.read_text()

# Extract the set content
match = re.search(r'ENGLISH_WORDS_4_OR_LESS = \{([^}]+)\}', content, re.DOTALL)
if not match:
    raise ValueError("Could not find ENGLISH_WORDS_4_OR_LESS set")

set_content = match.group(1)

# Extract all quoted strings
words = set()
for word_match in re.finditer(r'"([^"]+)"', set_content):
    words.add(word_match.group(1).lower())

# Add acronyms (3-4 letters)
acronyms = [
    "vip", "usa", "uk", "api", "url", "www", "http", "https", "ftp", "smtp", "pop3", "imap",
    "dns", "tcp", "udp", "ip", "mac", "cpu", "gpu", "ram", "rom", "ssd", "hdd", "usb", "hdmi",
    "wifi", "bluetooth", "nfc", "gps", "sms", "mms", "pdf", "doc", "xls", "ppt", "jpg", "png",
    "gif", "mp3", "mp4", "avi", "zip", "rar", "exe", "dll", "iso", "bin", "csv", "xml", "json",
    "html", "css", "js", "php", "asp", "sql", "db", "id", "ui", "ux", "qa", "hr", "it", "ceo",
    "cto", "cfo", "cio", "vp", "pm", "pr", "ad", "tv", "cd", "dvd", "pc", "os", "ai", "ml",
    "ar", "vr", "iot", "aws", "gcp", "azure", "saas", "paas", "iaas", "cdn", "sso", "mfa",
    "2fa", "otp", "jwt", "oauth", "rest", "soap", "rpc", "grpc", "graphql", "crud", "orm",
    "mvc", "mvp", "mcp", "sdk", "api", "cli", "gui", "ide", "sdk", "npm", "pip", "gem",
]

# Add swear words (common 3-4 letter ones)
swear_words = [
    "fuck", "shit", "damn", "hell", "crap", "piss", "ass", "bitch", "dick", "cock", "cunt",
    "pussy", "tits", "boob", "fag", "gay", "dyke", "whore", "slut", "bitch", "bastard",
    "wank", "jerk", "turd", "fart", "poop", "butt", "arse", "arse", "bugger", "bloody",
]

# Combine all words
all_words = words | set(acronyms) | set(swear_words)

# Write to text file (one word per line, sorted)
output_path = Path(__file__).parent.parent / "app" / "blocked_words.txt"
with open(output_path, "w") as f:
    for word in sorted(all_words):
        if len(word) <= 4:  # Only keep words <= 4 characters
            f.write(f"{word}\n")

print(f"Created {output_path} with {len([w for w in all_words if len(w) <= 4])} words")
