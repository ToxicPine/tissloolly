{ pkgs, ... }:

pkgs.writeShellApplication {
  name = "boondoggle";
  runtimeInputs = with pkgs; [
    coreutils
    curl
    git
    gnused
    jq
    codex
  ];
  text = builtins.readFile ./boondoggle.sh;
}
