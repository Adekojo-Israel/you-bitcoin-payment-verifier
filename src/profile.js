const ACCEPTED = new Set(['image/png','image/jpeg','image/webp']);
const MAX_PHOTO_SIZE = 2 * 1024 * 1024;
export function validStoredPhoto(photo){
  return typeof photo==='string'&&photo.length<=100000&&/^data:image\/(?:webp|png);base64,[A-Za-z0-9+/]+=*$/.test(photo);
}
export async function prepareProfilePhoto(file){
  if(!file||!ACCEPTED.has(file.type)||file.size>MAX_PHOTO_SIZE)throw Error('Choose a PNG, JPEG or WebP picture of 2 MB or less.');
  const data=await new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read that picture.'));reader.readAsDataURL(file);
  });
  const picture=new Image();picture.src=data;
  try{await picture.decode();}catch{throw Error('Could not open that picture. Try another file.');}
  const side=Math.min(picture.naturalWidth,picture.naturalHeight);
  if(!side||picture.naturalWidth*picture.naturalHeight>16_000_000)throw Error('Use a smaller picture.');
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('This browser could not resize the picture.');
  ctx.drawImage(picture,(picture.naturalWidth-side)/2,(picture.naturalHeight-side)/2,side,side,0,0,128,128);
  const photo=canvas.toDataURL('image/webp',.82);
  if(!validStoredPhoto(photo))throw Error('Could not prepare that picture. Try another file.');
  return photo;
}
