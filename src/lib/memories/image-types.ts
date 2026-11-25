export type MemoryImageType='image/webp'|'image/jpeg'|'image/png'

export function detectMemoryImageType(bytes:Uint8Array):MemoryImageType|null{
 if(bytes.length>=12&&bytes[0]===0x52&&bytes[1]===0x49&&bytes[2]===0x46&&bytes[3]===0x46&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp'
 if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg'
 if(bytes.length>=8&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a)return 'image/png'
 return null
}

export function isAllowedMemoryPhoto(bytes:Uint8Array,declaredType:string,size:number){
 return size>0&&size<=8*1024*1024&&detectMemoryImageType(bytes)===declaredType
}
