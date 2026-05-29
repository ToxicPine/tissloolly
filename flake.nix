{
  description = "Silly Tools, TiSslooly";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      forAllSystems = f:
        nixpkgs.lib.genAttrs nixpkgs.lib.systems.flakeExposed (system:
          f (import nixpkgs {
            inherit system;
            config.allowUnfree = true;
          }));
    in
    {
      packages = forAllSystems (pkgs: {
        boondoggle = pkgs.callPackage ./packages/boondoggle { };
        foolfad = pkgs.callPackage ./packages/foolfad { };
        ghwc = pkgs.callPackage ./packages/ghwc { };
        ghwrc = pkgs.callPackage ./packages/ghwrc { };
        default = pkgs.writeShellApplication {
          name = "tissloolly";
          text = ''
            echo "hello from tissloolly"
          '';
        };
      });
    };
}
