# Exarlo Tempmail

The open-source codebase for the temporary email service running at **[tempmail.exarlo.xyz](https://tempmail.exarlo.xyz)**.

This is a hobby project built to provide a clean, terminal-styled interface for generating disposable email addresses. While it runs on my custom domain infrastructure (`@exarlo.xyz`), the project is open-source for transparency and educational purposes.

## About the Project

This tool is a client-side wrapper around the [Dropmail.me](https://dropmail.me) GraphQL API. It allows anyone visiting the site to instantly generate a secure, temporary email address to bypass spam filters and verification walls.

### Features

- **Live @exarlo.xyz Addresses:** Generates usable email addresses on my custom domain.
- **Smart OTP Parser:** Automatically detects 4-8 digit verification codes in incoming emails and provides a one-click copy button.
- **Terminal UI:** A responsive, hacker-themed interface with real-time inbox polling.
- **Privacy Focused:** No logs are kept on the host; everything runs in your browser memory.

## How It Works

The application is entirely **client-side** (HTML/JS/CSS). It creates a direct connection from your browser to the mail server API using a CORS proxy.

1. **Identity:** On load, the app negotiates a session with the Dropmail API.
2. **Polling:** It checks for new "packets" (emails) every 8 seconds.
3. **Parsing:** Incoming mail is scanned locally in your browser for verification codes using Regex.

## Running Locally

If you want to run this code yourself or contribute:

1. **Clone the repo:**
```bash
git clone https://github.com/exar1o/tempmail.exarlo.xyz.git
```

2. **Configuration:**
The live site injects API tokens during deployment. To run locally, you will need to edit `script.js` and add your own Dropmail API token (or use the placeholder if testing UI only).

3. **Launch:**
Open `index.html` in any web browser.

## Disclaimer

This service is provided "as is" for testing and anti-spam purposes. Do not use disposable emails for critical accounts (banking, government services, etc.), as access to the inbox is lost once the browser session is cleared.

## License

[MIT](LICENSE)
