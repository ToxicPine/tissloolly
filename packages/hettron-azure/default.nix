{ pkgs, ... }:

let
  denoDeps = pkgs.stdenvNoCC.mkDerivation {
    pname = "hettron-azure-deno-deps";
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

      mkdir -p "$out"
      cp -R vendor "$out/"
      if [ -d node_modules ]; then
        cp -R node_modules "$out/"
      fi

      runHook postInstall
    '';

    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    outputHash = "sha256-oRonRpSK6X+FUures5qqOjc68ELFVkwaKa/LJv8NT20=";
  };
in
pkgs.stdenvNoCC.mkDerivation {
  pname = "hettron-azure";
  version = "0.1.0";
  src = ./.;

  nativeBuildInputs = [
    pkgs.makeWrapper
  ];

  installPhase = ''
    runHook preInstall

    mkdir -p "$out/share/hettron-azure" "$out/bin"
    cp -R deno.json deno.lock src "$out/share/hettron-azure/"
    cp -R ${denoDeps}/vendor "$out/share/hettron-azure/"
    if [ -d ${denoDeps}/node_modules ]; then
      cp -R ${denoDeps}/node_modules "$out/share/hettron-azure/"
    fi

    makeWrapper ${pkgs.deno}/bin/deno "$out/bin/hettron-azure" \
      --prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.bash pkgs.azure-cli ]} \
      --add-flags "run" \
      --add-flags "--vendor=true" \
      --add-flags "--node-modules-dir=manual" \
      --add-flags "--config $out/share/hettron-azure/deno.json" \
      --add-flags "--lock $out/share/hettron-azure/deno.lock" \
      --add-flags "--allow-run" \
      --add-flags "--allow-read" \
      --add-flags "--allow-write" \
      --add-flags "--allow-net" \
      --add-flags "--allow-env=PATH,HOME,AZURE_CONFIG_DIR" \
      --add-flags "$out/share/hettron-azure/src/main.ts"

    runHook postInstall
  '';
}
