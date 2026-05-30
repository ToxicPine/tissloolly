{ pkgs, ... }:

pkgs.writeShellApplication {
  name = "foolfad-fly";
  runtimeInputs = with pkgs; [
    flyctl
  ];
  text = builtins.readFile ./foolfad-fly.sh;
}
