import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { isoCBOR } from "@simplewebauthn/server/helpers";

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest();

/** A software passkey (ES256, attestation "none") that answers the server's options like a phone would. */
export function softwarePasskey(origin = "http://localhost") {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" });
  const id = randomBytes(16);
  const rpId = new URL(origin).hostname;
  let counter = 0;

  const authData = (attested: boolean) => {
    const counterBytes = Buffer.alloc(4);
    counterBytes.writeUInt32BE(++counter);
    const flags = Buffer.from([0x01 | 0x04 | (attested ? 0x40 : 0)]);
    const parts = [sha256(rpId), flags, counterBytes];
    if (attested) {
      const coseKey = new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, Buffer.from(jwk.x!, "base64url")],
        [-3, Buffer.from(jwk.y!, "base64url")],
      ]);
      const length = Buffer.alloc(2);
      length.writeUInt16BE(id.length);
      parts.push(Buffer.alloc(16), length, id, Buffer.from(isoCBOR.encode(coseKey)));
    }
    return Buffer.concat(parts);
  };
  const clientData = (type: string, challenge: string) => Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));

  return {
    id: b64url(id),
    register({ challenge }: { challenge: string }) {
      const attestationObject = isoCBOR.encode(new Map<string, unknown>([["fmt", "none"], ["attStmt", new Map()], ["authData", authData(true)]]) as never);
      return {
        id: b64url(id),
        rawId: b64url(id),
        type: "public-key",
        clientExtensionResults: {},
        response: { clientDataJSON: b64url(clientData("webauthn.create", challenge)), attestationObject: b64url(attestationObject), transports: ["internal"] },
      };
    },
    answer({ challenge }: { challenge: string }) {
      const data = authData(false);
      const json = clientData("webauthn.get", challenge);
      const signature = sign("sha256", Buffer.concat([data, sha256(json)]), privateKey);
      return {
        id: b64url(id),
        rawId: b64url(id),
        type: "public-key",
        clientExtensionResults: {},
        response: { clientDataJSON: b64url(json), authenticatorData: b64url(data), signature: b64url(signature) },
      };
    },
  };
}
