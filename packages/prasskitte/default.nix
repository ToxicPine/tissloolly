{ pkgs, ... }:

pkgs.writeShellApplication {
  name = "prasskitte";
  runtimeInputs = with pkgs; [
    coreutils
    curl
    gnused
    jq
  ];
  text = builtins.readFile ./prasskitte.sh;
}
