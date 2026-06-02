# Connect the machine to Telegram

This is optional. Do it once per machine when the user wants either feature:

- **Progress pings while offloaded work runs.** `vusperize --deliver telegram` sends updates to a
  Telegram chat.
- **Phone access to the agent on the machine.** The user can message the Telegram bot instead of
  staying at a terminal.

Telegram is free. The bot token is a password. Treat it as secret and confirm before saving it.

## Plain Model

A Telegram bot is a Telegram account controlled by a program. The user creates the bot and receives
a long password called a **token**. Save that token on the machine, then list the Telegram user IDs
allowed to talk to it. After that, messaging the bot messages the agent, and progress pings appear
as messages from the bot.

This does not change the user's normal Telegram account. It only lets that account chat with the new
bot.

## 1. Make the bot

The user creates the bot by talking to Telegram's official bot maker:

1. Open Telegram and search for **@BotFather** (or open https://t.me/BotFather).
2. Send `/newbot`.
3. Pick a display name (anything, e.g. "My Offload Agent").
4. Pick a username — it has to be unique and end in `bot` (e.g. `my_offload_bot`).
5. BotFather replies with the **token**, which looks like `123456789:ABCdef...`.

The token is the bot's password. If it leaks, the user can revoke it with `/revoke` in BotFather and
make a new one.

## 2. Get the user's Telegram ID

The machine allows users by numeric Telegram user ID, such as `123456789`, **not** by `@username`.
The easiest way to find it: in Telegram, message
**@userinfobot** (https://t.me/userinfobot) and it replies with the ID. Save that number.

If more than one person should be allowed, collect each of their IDs.

## 3. Give the machine the token and the allowed users

These are secrets the *machine itself* needs, so store them in the machine's secret store, never in
a project. Using `ambit`:

```bash
npx @cardelli/ambit secrets set <machine>.<network> TELEGRAM_BOT_TOKEN=<token> --json
npx @cardelli/ambit secrets set <machine>.<network> TELEGRAM_ALLOWED_USERS=<id> --json
```

`TELEGRAM_ALLOWED_USERS` takes a comma-separated list when more than one person is allowed, e.g.
`111111111,222222222`.

Optionally, set a "home" chat. This is where the agent sends messages it starts, such as scheduled
results or `vusperize` pings when no chat is passed. For a normal one-on-one chat with the bot, use
the user's Telegram ID:

```bash
npx @cardelli/ambit secrets set <machine>.<network> TELEGRAM_HOME_CHANNEL=<id> --json
```

## 4. Check it works

The agent on the machine reads these settings when its gateway runs. Have the user open Telegram,
find the new bot by username, and send it a message. It should answer within a few seconds.

If it stays silent, check the common causes:

- The token was mistyped.
- The user's numeric ID is missing from `TELEGRAM_ALLOWED_USERS`.
- The gateway was already running and has not read the new secrets yet. Restart the machine if needed.

## Using it for offload progress pings

Once Telegram is connected, wrap a long remote command with `vusperize`:

```bash
foolfad -- bash -lc 'vusperize --deliver telegram -- <long command>'
```

If `TELEGRAM_HOME_CHANNEL` is set, pings go there automatically. To send them to a specific chat,
add `--deliver-chat-id <id>`. For a one-on-one chat with the bot, that ID is the user's own Telegram
ID.

## Where these settings live

The bot token, allowed users, and home chat belong to the *machine*. Keep them in
`ambit secrets set --json`, out of every project. Machine credentials stay with the machine.
Project-specific settings stay with the project.
