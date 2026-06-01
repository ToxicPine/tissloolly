{ pkgs, ... }:

let
  denoDeps = pkgs.stdenvNoCC.mkDerivation {
    pname = "foolfad-config-deno-deps";
    version = "0.1.0";
    src = ./.;

    nativeBuildInputs = [
      pkgs.deno
    ];

    buildPhase = ''
      runHook preBuild

      export DENO_DIR="$TMPDIR/deno-cache"
      deno cache \
        --vendor=true \
        --config deno.json \
        --lock deno.lock \
        src/main.ts

      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall

      rm -f node_modules/.deno/.setup-cache.bin

      mkdir -p "$out"
      cp -R node_modules "$out/"

      runHook postInstall
    '';

    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    outputHash = "sha256-83LRLx0ESnL5CZ7Z6eRBpcXk6hyILs2qVEFLVoPFtdU=";
  };
in
pkgs.stdenvNoCC.mkDerivation {
  pname = "foolfad-config";
  version = "0.1.0";
  src = ./.;

  nativeBuildInputs = [
    pkgs.makeWrapper
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p "$out/share/foolfad-config" "$out/bin"
    cp -R README.md deno.json deno.lock src "$out/share/foolfad-config/"
    cp -R ${denoDeps}/node_modules "$out/share/foolfad-config/"

    makeWrapper ${pkgs.deno}/bin/deno "$out/bin/foolfad-configure" \
      --add-flags "run" \
      --add-flags "--vendor=true" \
      --add-flags "--node-modules-dir=manual" \
      --add-flags "--config $out/share/foolfad-config/deno.json" \
      --add-flags "--lock $out/share/foolfad-config/deno.lock" \
      --add-flags "--allow-run" \
      --add-flags "--allow-read=$out/share/foolfad-config" \
      --add-flags "--allow-env=FOOLFAD_CONFIG_TRANSPORT" \
      --add-flags "$out/share/foolfad-config/src/main.ts"

    runHook postInstall
  '';
}
