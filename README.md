# quoted-printable-lite

* Ever needed to send utf-8 data through communication standards established in the 90s and earlier?
* Want a simple, zero-dependency library you can shove a buffer containing utf8 text into and get 7-bit safe data in return?
* Are you that afraid of using base64 to bloat the size of your auto-generated e-mails?
* Are you parsing .eml files for some strange-ass reason?

_Well, then `quoted-printable-lite` is the package for you_

This package implements [the `Quoted-Printable` content transfer encoding as defined by RFC 2045](https://tools.ietf.org/html/rfc2045#section-6.7)

## What is a "Quoted-Printable"?

It's a binary-to-text encoding scheme that only uses 7-bit ascii. Think URI-Encoding except with "=" instead of "%" with a 76 character wide limit (I know right)

## Where can I use it?

Browser and node. This thing will use/return Buffers if it finds a global Buffer object. Otherwise, it'll use Uint8Arrays

## How do I use it?

```js
const {encode, decode} = require("quoted-printable-lite");
const textToEncode = "Hello, world!😄\nHow are you? This is a real nice day today, isn't it? Do you think I hit 76 characers yet for this demonstration? Probably";


const encodedBuffer = encode(
    Buffer.from(textToEncode), // You can use TextEncoder.prototype.encode on the browser for this
    true, // crlf = true, makes line breaks "\r\n". Otherwise, "\n"
    false, // binary = false, if true, it'll escape "\r" and "\n" characters as-is. Otherwise, line-breaks are converted to whatever's above
    76 // maxLineLength = 76, lines will not exceed this length
);

const encodedString = buffer.toString(); // You can use String.fromCharCode(...buffer) on the browser for this
/*
Will output:
    "Hello, world!=F0=9F=98=84\r\n" +
    "How are you? This is a real nice day today, isn't it? Do you think I hit 76=\r\n" +
    " characers yet for this demonstration? Probably"
*/
console.log(encodedString);

const decodedBuffer = decode(
    encodedBuffer,
    true, // crlf = true, makes line breaks "\r\n". Otherwise, "\n" (escaped "\r" and "\n" characters are unaffected)
    false // inPlace = false, if true, the given buffer will be edited and a subarray will be returned
);

/*
Will output:
"Hello, world!😄\r\nHow are you? This is a real nice day today, isn't it? Do you think I hit 76 characers yet for this demonstration? Probably"
*/
console.log(decodedBuffer.toString()); 
```