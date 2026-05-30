{ pkgs, ... }:

# foolfad transport adapters, shipped together so all three land on PATH at once.
let
  # Client-only tailscale: build just cmd/tailscale, dropping the tailscaled
  # daemon, its wrapped deps (iproute2/iptables/shadow/procps), and the systemd
  # unit — none of which `tailscale ssh` needs.
  tailscale-lite = pkgs.tailscale.overrideAttrs (_: {
    pname = "tailscale-lite";
    subPackages = [ "cmd/tailscale" ];
    outputs = [ "out" ];
    postInstall = "";
  });

  mkAdapter = name: runtimeInputs:
    pkgs.writeShellApplication {
      inherit name runtimeInputs;
      text = builtins.readFile (./. + "/${name}.sh");
    };
in
pkgs.symlinkJoin {
  name = "foolfad-transports";
  paths = [
    (mkAdapter "foolfad-ssh" [ pkgs.openssh ])
    # tailscale ssh execs the system ssh, so openssh is needed too.
    (mkAdapter "foolfad-tailscale" [ tailscale-lite pkgs.openssh ])
    (mkAdapter "foolfad-fly" [ pkgs.flyctl ])
  ];
}
