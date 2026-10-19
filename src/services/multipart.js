/**
 * Minimal multipart/form-data body builder (Wave 2, W2-B3 media uploads).
 *
 * Why hand-built? Expo SDK 57's runtime gives us two serializer paths that
 * both broke on device:
 *   1. RN's FormData + legacy {uri, name, type} parts -> expo/winter's
 *      converter throws "Unsupported FormDataPart implementation".
 *   2. RN's global Blob (setUpXHR polyfill) -> its constructor explicitly
 *      throws "Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are
 *      not supported", so a Blob part cannot be built from picked-file bytes
 *      at all.
 *
 * This module only uses TextEncoder + Uint8Array — no Blob, no FormData, no
 * runtime serializer — and produces a byte-exact RFC 7578 body. The server
 * (multer) parses it like any other multipart request. Pairs with
 * expo fetch, which accepts ArrayBufferView bodies directly and lets
 * apiRequest's header spread override the JSON content-type.
 *
 * Node-compatible (pure functions) so scripts can unit-test the exact bytes
 * with busboy, the same parser family multer uses.
 */

const encoder = new TextEncoder();

/** Strips characters that could break or spoof Content-Disposition headers. */
function headerSafe(value) {
  return String(value).replace(/[\r\n"]/g, " ");
}

/** Concatenates Uint8Arrays into one buffer. */
export function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Random delimiter. Multipart only breaks if the full boundary string occurs
 * inside the file bytes — with ~64 bits of entropy per body this is
 * practically impossible for avatar-sized images.
 */
export function createBoundary() {
  const random = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `----HelpNest${Date.now().toString(16)}${random()}${random()}`;
}

/**
 * Builds a complete multipart/form-data body.
 *
 * @param {object} parts
 * @param {string} parts.boundary        Delimiter (see createBoundary).
 * @param {object} [parts.fields]        Simple text fields, e.g. { kind: "profile" }.
 * @param {object} parts.file            The binary part.
 * @param {string} parts.file.name       Form field name the server expects, e.g. "file".
 * @param {string} parts.file.filename   Filename reported to the server.
 * @param {string} parts.file.contentType  MIME type, e.g. "image/jpeg".
 * @param {Uint8Array} parts.file.bytes  Raw file content.
 * @returns {Uint8Array} The full request body.
 */
export function buildMultipartBody({ boundary, fields = {}, file }) {
  const chunks = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      encoder.encode(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${headerSafe(name)}"\r\n` +
          `\r\n` +
          `${String(value)}\r\n`
      )
    );
  }

  chunks.push(
    encoder.encode(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${headerSafe(file.name)}"; filename="${headerSafe(
          file.filename
        )}"\r\n` +
        `Content-Type: ${headerSafe(file.contentType)}\r\n` +
        `\r\n`
    )
  );
  chunks.push(file.bytes);
  chunks.push(encoder.encode(`\r\n--${boundary}--\r\n`));

  return concatBytes(chunks);
}
