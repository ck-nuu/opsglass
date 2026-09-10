# Mac and Windows collectors

A collector executes read-only probes on its own machine and sends observations to the portal over HTTPS. The browser never needs to reach `localhost` on another computer, and Cloudflare does not join your tailnet.

## Discover projects first

Clone this repository onto each computer. Install Node.js **22.18 or newer**; the collector uses Node’s native TypeScript support to share manifest detection with the portal. No npm installation is needed just to run the collector from the complete repository.

Mac:

```sh
node scripts/collector.mjs scan --root /Users/you/Projects --docker --output discoveries.json
```

Windows PowerShell:

```powershell
node scripts/collector.mjs scan --root 'C:\Projects' --docker --output discoveries.json
```

Choose a specific directory you want inspected. The scanner searches it and two directory levels below, inspects supported manifests inside common monorepo folders, skips symlinks, `.env` files, dependency folders and build output, and limits the output to 100 candidates. `--docker` additionally runs `docker ps -a` and reads container names, image names, and Compose grouping labels. It does not inspect environment variables, copy secrets, or restart anything.

Open **Import projects → Local discovery** in OpsGlass and select the JSON file. Review candidates before importing. A repository folder and its Docker project can appear separately; select the record you want, or merge the details manually. Docker images identify infrastructure, not necessarily the application’s internal language or framework.

## Register and connect a machine

1. Open **Connections → Register machine** in the portal.
2. Give it a recognisable name such as “Windows Docker server” or “Mac workstation”.
3. Download `collector.json`. Copy it privately to that machine.
4. Keep the downloaded portal URL. This deployment uses its own scoped collector credentials; no Cloudflare service token is needed.
5. Run the collector from the repository root:

```sh
node scripts/collector.mjs run --config /private/path/collector.json
```

PowerShell example:

```powershell
node scripts/collector.mjs run --config "$env:USERPROFILE\.config\opsglass\collector.json"
```

On macOS, restrict the file to your account with `chmod 600 /private/path/collector.json`. On Windows, keep it in your user profile and restrict its NTFS permissions to the account running the collector. Do not commit or share this file. The downloaded configuration enables Docker checks because that is the intended use here; set `allowDocker` to `false` if a particular machine should not inspect containers.

The collector polls once per minute, logs only check names and status (not tokens), and can be stopped with Ctrl+C. `--once` performs one heartbeat/assignment cycle for troubleshooting. Use a dedicated user LaunchAgent on the Mac or a Windows Task Scheduler task to keep it running after login; configure that startup task after checking the first successful connection. This build does not install persistent services automatically.

## Add checks

Open a project → Monitoring → Add check.

- **Docker:** select that machine’s collector and enter a container name or ID. The process must have permission to use the Docker CLI. A stopped or unhealthy container is failing; Docker being unavailable to the collector is unknown. If no Docker HEALTHCHECK exists, the result explicitly says that only the container’s running state was checked.
- **HTTP:** enter an address reachable from the collector, such as `http://localhost:8080/health`. Expect a specific HTTP status. TLS validation remains enabled.
- **DNS:** checks A records and optionally an exact expected address.
- **TLS:** checks certificate trust, validity and expiry; fewer than 14 days remaining is degraded. Use a hostname or HTTPS URL.
- **Ping:** checks reachability using the operating system’s ping executable. ICMP is not an application health check.

OpsGlass treats a passing HTTP response or running container as a specific observation. For confidence in the full application, add a health endpoint that checks its essential dependencies.

## Tailscale

Keep Tailscale for your private connectivity. A collector may check another tailnet machine using its Tailscale IP or DNS name when the collector’s host has access. Place a collector on each machine when you need that machine’s own Docker state.

Cloud checks reject local and private addresses; use the local collector for them. No Docker socket, SSH port, or application port needs to be exposed publicly for this setup.

## Intentionally stopped versus unavailable

For a deployment that you intentionally stop, turn off **Expected to be running** in its project record. Its checks are suspended without claiming the app is healthy.

A collector missing for over three minutes is offline. Its checks become unknown, even if the last stored result was healthy. A fresh collector with a stale check also shows unknown. A new collector credential cannot submit observations for another machine, and old assignments cannot be replayed after completion or expiry.
