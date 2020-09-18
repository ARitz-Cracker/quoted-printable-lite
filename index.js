const encodeEscapedText = function(buff, crlf, index, lineSize, maxLineLength, c){
	const hexString = (c < 16 ? "0" + c.toString(16) : c.toString(16)).toUpperCase(); // Yes, lower-case hex values are "formally illegal"
	const futureLineSize = lineSize + 3;
	if(futureLineSize > maxLineLength){
		buff[index++] = 61; // "="
		if(crlf){
			buff[index++] = 13; // "\r"
		}
		buff[index++] = 10; // "\n"
		buff[index++] = 61; // "="
		buff[index++] = hexString.charCodeAt(0);
		buff[index++] = hexString.charCodeAt(1);
		lineSize = 3;
	}else{
		buff[index++] = 61; // "="
		buff[index++] = hexString.charCodeAt(0);
		buff[index++] = hexString.charCodeAt(1);
		lineSize += 3;
		if(futureLineSize == maxLineLength){
			buff[index++] = 61; // "="
			if(crlf){
				buff[index++] = 13; // "\r"
			}
			buff[index++] = 10; // "\n"
			lineSize = 0;
		}
	}
	return [index, lineSize];
}
const alwaysEscapedBody = {
	61: true // "="
}
const alwaysEscapedHeader = {
	61: true, // "="
	63: true, // "?"
	95: true // "_"
}
const encode = function(buff = new Uint8Array(0), crlf = true, binary = false, maxLineLength = 76, alternate = false){
	maxLineLength -= 1;
	if(buff.length === 0){
		// This might end up breaking something, but at that point you probably deserve to suffer
		return buff;
	}
	const alwaysEscaped = alternate ? alwaysEscapedHeader : alwaysEscapedBody;
	let resultSize = 0;
	let resultIndex = 0;
	let currentlineSize = 0;
	// Currently I'm always going to encode tabs because I have no idea how many columns that'd be
	// "The Quoted-Printable encoding REQUIRES that encoded lines be no more than 76 characters long."
	// Okay, sure. But how many characters is a tab?! 1, 2, or 4?!

	const lastindex = buff.length - 1;
	for(let i = 0; i < lastindex; i += 1){
		const c = buff[i];
		if(!binary && c === 13){ //\r
			continue;
		}
		if(!binary && c === 10){ //\n
			// if crlf, convert all \n into \r\n
			// not crlf, strip out all \r
			resultSize += crlf ? 2 : 1;
			currentlineSize = 0;
		}else if(c >= 32 && c <= 126 && !alwaysEscaped[c]) {
			resultSize += 1;
			currentlineSize += 1;
			if(currentlineSize == maxLineLength){
				resultSize += 1; // "="
				resultSize += crlf ? 2 : 1;
				currentlineSize = 0;
			}
		}else{
			resultSize += 3;
			currentlineSize += 3;
			if(currentlineSize >= maxLineLength){
				resultSize += 1; // "="
				resultSize += crlf ? 2 : 1;
				currentlineSize = 3;
			}
		}
	}
	const c = buff[lastindex];
	
	if(!binary && c === 10){ //\n
		resultSize += crlf ? 2 : 1;
	}else if(c >= 33 && c <= 126 && !alwaysEscaped[c]) {
		// Last character cannot be a space (note the 33 instead of a 32)
		resultSize += 1;
	}else{
		resultSize += 3;
		currentlineSize += 3;
		if(currentlineSize > maxLineLength){
			resultSize += 1; // "="
			resultSize += crlf ? 2 : 1;
		}
	}
	currentlineSize = 0;
	const resultBuffer = typeof Buffer === "undefined" ? new Uint8Array(resultSize) : Buffer.alloc(resultSize);
	for(let i = 0; i < lastindex; i += 1){
		const c = buff[i];
		if(!binary && c === 13){ //\r
			continue;
		}
		if(!binary && c === 10){ //\n
			// if crlf, convert all \n into \r\n
			// not crlf, strip out all \r
			if(crlf){
				resultBuffer[resultIndex++] = 13; //"\r"
			}
			resultBuffer[resultIndex++] = 10; //"\n"
			currentlineSize = 0;
		}else if(c >= 32 && c <= 126 && !alwaysEscaped[c]) {
			if(c === 32 && alternate){
				resultBuffer[resultIndex++] = 95; // "_"
			}else{
				resultBuffer[resultIndex++] = c;
			}
			currentlineSize += 1;
			if(currentlineSize == maxLineLength){
				resultBuffer[resultIndex++] = 61; // "="
				if(crlf){
					resultBuffer[resultIndex++] = 13; // "\r"
				}
				resultBuffer[resultIndex++] = 10; // "\n"
				currentlineSize = 0;
			}
		}else{
			[resultIndex, currentlineSize] = encodeEscapedText(resultBuffer, crlf, resultIndex, currentlineSize, maxLineLength, c);
		}
	}
	if(!binary && c === 10){ //\n
		if(crlf){
			resultBuffer[resultIndex++] = 13; //"\r"
		}
		resultBuffer[resultIndex++] = 10; //"\n"
	}else if(c >= 33 && c <= 126 && !alwaysEscaped[c]) {
		// Last character cannot be a space (note the 33 instead of a 32)
		resultBuffer[resultIndex++] = c;
	}else{
		[resultIndex, currentlineSize] = encodeEscapedText(resultBuffer, crlf, resultIndex, currentlineSize, maxLineLength, c);
	}
	return resultBuffer;
}
const charCodeIsHex = function(c){
	// Returns false if undefined due to undefined being NaN
	return (
		(c <= 0x39 && c >= 0x30) || // 0-9
		(c <= 0x46 && c >= 0x41) || // A-F
		(c <= 0x66 && c >= 0x61) // a-f
	)
}
const readEncodedValue = function(buff, i){
	const c1 = buff[i];
	const c2 = buff[i + 1];
	if(charCodeIsHex(c1) && charCodeIsHex(c2)){
		return parseInt(String.fromCharCode(c1, c2), 16);
	}
	return null;
}
const jumpFowardIfSoftLineBreak = function(buff, i){
	if(buff[i] === 10){
		return 1
	}
	if(buff[i] === 13 && buff[i + 1] === 10){
		return 2;
	}
	return 0;
}
const decode = function(buff = new Uint8Array(0), crlf = true, inPlace = false, alternate = false){
	if(!inPlace){
		buff = typeof Buffer === "undefined" ? new Uint8Array(buff) : Buffer.from(buff);
	}
	let resultIndex = 0;
	for(let i = 0; i < buff.length; i += 1){
		const c = buff[i];
		if(c === 13){ // "\r"
			continue;
		}
		if(c === 10){ // "\n"
			if(crlf){
				buff[resultIndex++] = 13;
			}
			buff[resultIndex++] = 10;
			continue;
		}
		if(c === 61){
			const skipForwardBy = jumpFowardIfSoftLineBreak(buff, i + 1);
			if(skipForwardBy > 0){
				i += skipForwardBy;
				continue;
			}
			const encodedValue = readEncodedValue(buff, i + 1);
			if(encodedValue == null){
				buff[resultIndex++] = c;
			}else{
				buff[resultIndex++] = encodedValue;
				i += 2;
			}
			continue;
		}
		if(c === 95 && alternate){
			buff[resultIndex++] = 32;
			continue;
		}
		buff[resultIndex++] = c;
	}
	return buff.subarray(0, resultIndex);
}
module.exports = {encode, decode};
