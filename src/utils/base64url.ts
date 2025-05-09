/**
 * Avoid modifying this file. It's part of
 * https://github.com/skorpland-community/base64url-js.  Submit all fixes on
 * that repo!
 */

/**
 * An array of characters that encode 6 bits into a Base64-URL alphabet
 * character.
 */
const TO_BASE64URL =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".split("");

/**
 * An array of characters that can appear in a Base64-URL encoded string but
 * should be ignored.
 */
const IGNORE_BASE64URL = " \t\n\r=".split("");

/**
 * An array of 128 numbers that map a Base64-URL character to 6 bits, or if -2
 * used to skip the character, or if -1 used to error out.
 */
const FROM_BASE64URL = (() => {
  const charMap: number[] = new Array(128);

  for (let i = 0; i < charMap.length; i += 1) {
    charMap[i] = -1;
  }

  for (let i = 0; i < IGNORE_BASE64URL.length; i += 1) {
    charMap[IGNORE_BASE64URL[i].charCodeAt(0)] = -2;
  }

  for (let i = 0; i < TO_BASE64URL.length; i += 1) {
    charMap[TO_BASE64URL[i].charCodeAt(0)] = i;
  }

  return charMap;
})();

/**
 * Converts a JavaScript string (which may include any valid character) into a
 * Base64-URL encoded string. The string is first encoded in UTF-8 which is
 * then encoded as Base64-URL.
 *
 * @param str The string to convert.
 */
export function stringToBase64URL(str: string) {
  const base64: string[] = [];

  let queue = 0;
  let queuedBits = 0;

  const emitter = (byte: number) => {
    queue = (queue << 8) | byte;
    queuedBits += 8;

    while (queuedBits >= 6) {
      const pos = (queue >> (queuedBits - 6)) & 63;
      base64.push(TO_BASE64URL[pos]);
      queuedBits -= 6;
    }
  };

  stringToUTF8(str, emitter);

  if (queuedBits > 0) {
    queue = queue << (6 - queuedBits);
    queuedBits = 6;

    while (queuedBits >= 6) {
      const pos = (queue >> (queuedBits - 6)) & 63;
      base64.push(TO_BASE64URL[pos]);
      queuedBits -= 6;
    }
  }

  return base64.join("");
}

/**
 * Converts a Base64-URL encoded string into a JavaScript string. It is assumed
 * that the underlying string has been encoded as UTF-8.
 *
 * @param str The Base64-URL encoded string.
 */
export function stringFromBase64URL(str: string) {
  const conv: string[] = [];

  const emit = (codepoint: number) => {
    conv.push(String.fromCodePoint(codepoint));
  };

  const state = {
    utf8seq: 0,
    codepoint: 0,
  };

  let queue = 0;
  let queuedBits = 0;

  for (let i = 0; i < str.length; i += 1) {
    const codepoint = str.charCodeAt(i);
    const bits = FROM_BASE64URL[codepoint];

    if (bits > -1) {
      // valid Base64-URL character
      queue = (queue << 6) | bits;
      queuedBits += 6;

      while (queuedBits >= 8) {
        stringFromUTF8((queue >> (queuedBits - 8)) & 0xff, state, emit);
        queuedBits -= 8;
      }
    } else if (bits === -2) {
      // ignore spaces, tabs, newlines, =
      continue;
    } else {
      throw new Error(
        `Invalid Base64-URL character "${str.at(i)}" at position ${i}`,
      );
    }
  }

  return conv.join("");
}

/**
 * Converts a Unicode codepoint to a multi-byte UTF-8 sequence.
 *
 * @param codepoint The Unicode codepoint.
 * @param emit      Function which will be called for each UTF-8 byte that represents the codepoint.
 */
export function codepointToUTF8(
  codepoint: number,
  emit: (byte: number) => void,
) {
  if (codepoint <= 0x7f) {
    emit(codepoint);
    return;
  } else if (codepoint <= 0x7ff) {
    emit(0xc0 | (codepoint >> 6));
    emit(0x80 | (codepoint & 0x3f));
    return;
  } else if (codepoint <= 0xffff) {
    emit(0xe0 | (codepoint >> 12));
    emit(0x80 | ((codepoint >> 6) & 0x3f));
    emit(0x80 | (codepoint & 0x3f));
    return;
  } else if (codepoint <= 0x10ffff) {
    emit(0xf0 | (codepoint >> 18));
    emit(0x80 | ((codepoint >> 12) & 0x3f));
    emit(0x80 | ((codepoint >> 6) & 0x3f));
    emit(0x80 | (codepoint & 0x3f));
    return;
  }

  throw new Error(`Unrecognized Unicode codepoint: ${codepoint.toString(16)}`);
}

/**
 * Converts a JavaScript string to a sequence of UTF-8 bytes.
 *
 * @param str  The string to convert to UTF-8.
 * @param emit Function which will be called for each UTF-8 byte of the string.
 */
export function stringToUTF8(str: string, emit: (byte: number) => void) {
  for (let i = 0; i < str.length; i += 1) {
    let codepoint = str.charCodeAt(i);

    if (codepoint > 0xd7ff && codepoint <= 0xdbff) {
      // most UTF-16 codepoints are Unicode codepoints, except values in this
      // range where the next UTF-16 codepoint needs to be combined with the
      // current one to get the Unicode codepoint
      const highSurrogate = ((codepoint - 0xd800) * 0x400) & 0xffff;
      const lowSurrogate = (str.charCodeAt(i + 1) - 0xdc00) & 0xffff;
      codepoint = (lowSurrogate | highSurrogate) + 0x10000;
      i += 1;
    }

    codepointToUTF8(codepoint, emit);
  }
}

/**
 * Converts a UTF-8 byte to a Unicode codepoint.
 *
 * @param byte  The UTF-8 byte next in the sequence.
 * @param state The shared state between consecutive UTF-8 bytes in the
 *              sequence, an object with the shape `{ utf8seq: 0, codepoint: 0 }`.
 * @param emit  Function which will be called for each codepoint.
 */
export function stringFromUTF8(
  byte: number,
  state: { utf8seq: number; codepoint: number },
  emit: (codepoint: number) => void,
) {
  if (state.utf8seq === 0) {
    if (byte <= 0x7f) {
      emit(byte);
      return;
    }

    // count the number of 1 leading bits until you reach 0
    for (let leadingBit = 1; leadingBit < 6; leadingBit += 1) {
      if (((byte >> (7 - leadingBit)) & 1) === 0) {
        state.utf8seq = leadingBit;
        break;
      }
    }

    if (state.utf8seq === 2) {
      state.codepoint = byte & 31;
    } else if (state.utf8seq === 3) {
      state.codepoint = byte & 15;
    } else if (state.utf8seq === 4) {
      state.codepoint = byte & 7;
    } else {
      throw new Error("Invalid UTF-8 sequence");
    }

    state.utf8seq -= 1;
  } else if (state.utf8seq > 0) {
    if (byte <= 0x7f) {
      throw new Error("Invalid UTF-8 sequence");
    }

    state.codepoint = (state.codepoint << 6) | (byte & 63);
    state.utf8seq -= 1;

    if (state.utf8seq === 0) {
      emit(state.codepoint);
    }
  }
}
