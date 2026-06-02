# Connecting the machine to Telegram (first-time setup)

This is optional, and you only do it once per machine. Set it up when the user wants either of
these:

- **Progress pings while offloaded work runs** — the updates vusperize can send (`--deliver
  telegram`) land in a Telegram chat.
- **To chat with the agent on the machine from their phone** — message it on Telegram instead of
  being at a terminal.

Telegram itself is free. The only secret involved is the bot's token, which is a password — treat
it carefully and confirm with the user before saving it.

## The idea, in plain terms

A "Telegram bot" is just a second Telegram account that a program controls instead of a person.
You create one, and it gives you a long password called a **token**. You hand that token to the
machine, and tell the machine which Telegram users are allowed to talk to it. After that, the
agent running on the machine can send and receive Telegram messages — so messaging the bot is
messaging the agent, and progress pings show up as messages from the bot.

Nothing here touches the user's normal Telegram account beyond them chatting with their own new
bot.

## 1. Make the bot

In Telegram, the user creates the bot by talking to Telegram's official bot-maker:

1. Open Telegram and search for **@BotFather** (or open https://t.me/BotFather).
2. Send `/newbot`.
3. Pick a display name (anything, e.g. "My Offload Agent").
4. Pick a username — it has to be unique and end in `bot` (e.g. `my_offload_bot`).
5. BotFather replies with the **token**, which looks like `123456789:ABCdef...`.

That token is the bot's password. If it ever leaks, the user can revoke it with `/revoke` in
BotFather and make a new one.

## 2. Get the user's Telegram ID

The machine decides who's allowed to talk to the bot by numeric Telegram user ID — a number like
`123456789`, **not** the `@username`. The easiest way to find it: in Telegram, message
**@userinfobot** (https://t.me/userinfobot) and it replies with the ID. Save that number.

If more than one person should be allowed, collect each of their IDs.

## 3. Give the machine the token and the allowed users

These are secrets the *machine itself* needs, so they go in the machine's secret store — never in
a project. Using ambit (the same tool from the provisioning steps):

```bash
npx @cardelli/ambit secrets set <machine>.<network> TELEGRAM_BOT_TOKEN=<token>
npx @cardelli/ambit secrets set <machine>.<network> TELEGRAM_ALLOWED_USERS=<id>
```

`TELEGRAM_ALLOWED_USERS` takes a comma-separated list if there's more than one person, e.g.
`111111111,222222222`.

Optionally, also set a "home" chat — the chat the agent sends to when *it* starts a message
(scheduled results, and the destination for vusperize pings if you don't pass one each time). For
a normal one-on-one chat with the bot, this is the same number as the user's own ID:

```bash
npx @cardelli/ambit secrets set <machine>.<network> TELEGRAM_HOME_CHANNEL=<id>
```

## 4. Check it works

The agent on the machine picks up these settings when its gateway runs. Have the user open
Telegram, find their new bot (by the username from step 1), and send it a message — it should
answer within a few seconds. If it stays silent, the usual causes are a mistyped token or the
user's ID not being in `TELEGRAM_ALLOWED_USERS`. (If the gateway was already running, it may need
to be restarted to pick up newly added secrets — restart the machine if a message goes
unanswered.)

## Using it for offload progress pings

Once Telegram is connected, wrap a long remote command with vusperize and send updates to
Telegram:

```bash
foolfad -- bash -lc 'vusperize --deliver telegram -- <your command that calls tofiny ...>'
```

If you set `TELEGRAM_HOME_CHANNEL` above, the pings go there automatically. To send them to a
specific chat instead, add `--deliver-chat-id <id>` (for a one-on-one chat with the bot, that id
is the user's own Telegram ID).

## Where these settings live

The bot token, allowed users, and home chat all belong to the *machine* — keep them in
`ambit secrets set`, out of any project. This is the same rule the provisioning doc uses for
machine credentials: machine credentials stay with the machine; project-specific settings stay with
the project.
