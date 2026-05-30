{ pkgs, ... }:

pkgs.writeShellApplication {
  name = "foolfad-tailscale";
  runtimeInputs = with pkgs; [
    tailscale
  ];
  text = builtins.readFile ./foolfad-tailscale.sh;
}
