import { WebDemuxer } from 'web-demuxer'

// Track if warning has been shown
let warningShown = false;

function showDemoWarning() {
  if (!warningShown) {
    console.warn(
      '⚠️  Demo/Learning Function: This utility is intended for demos and learning purposes only. ' +
      'For production use, please use a proper demuxing library like MediaBunny (https://mediabunny.dev/) ' +
      'or web-demuxer (https://github.com/bilibili/web-demuxer) directly.'
    );
    warningShown = true;
  }
}

export async function getVideoChunks(file: File): Promise<EncodedVideoChunk[]> {
    showDemoWarning();

    const demuxer = new WebDemuxer({
        wasmFilePath: "https://cdn.jsdelivr.net/npm/web-demuxer@latest/dist/wasm-files/web-demuxer.wasm",
    });


    await demuxer.load(file);

    const reader = demuxer.read('video', 0).getReader()

    const chunks:EncodedVideoChunk[] = [];

    return new Promise(function(resolve){

        reader.read().then(async function processPacket(result: ReadableStreamReadResult<EncodedVideoChunk>): Promise<void> {
            const {done, value} = result;
            if(value) chunks.push(value);
            if(done) return resolve(chunks);
            return reader.read().then(processPacket)
        });

   });

}



export async function demuxAudio(file: File): Promise<{chunks: EncodedAudioChunk[], config: AudioDecoderConfig}>{
    showDemoWarning();

    const demuxer = new WebDemuxer({
        wasmFilePath: "https://cdn.jsdelivr.net/npm/web-demuxer@latest/dist/wasm-files/web-demuxer.wasm",
    });


    await demuxer.load(file);

    const reader = demuxer.read('audio', 0).getReader()

    const chunks:EncodedAudioChunk[] = [];

    await new Promise(function(resolve){

        reader.read().then(async function processPacket(result: ReadableStreamReadResult<EncodedAudioChunk>): Promise<void> {
            const {done, value} = result;
            if(value) chunks.push(value);
            if(done) return resolve(chunks);
            return reader.read().then(processPacket)
        });

   });

   const mediaInfo = await demuxer.getMediaInfo();
   const audioTrack = mediaInfo.streams.filter((s)=>s.codec_type_string === 'audio')[0];
   
   
   const config: AudioDecoderConfig = {
       codec: audioTrack.codec_string,
       sampleRate: audioTrack.sample_rate,
       numberOfChannels: audioTrack.channels
   }

   return {
    chunks,
    config
   }
   
}


export async function demuxVideo(file: File): Promise<{chunks: EncodedVideoChunk[], config: VideoDecoderConfig}>{
    showDemoWarning();

    const demuxer = new WebDemuxer({
        wasmFilePath: "https://cdn.jsdelivr.net/npm/web-demuxer@latest/dist/wasm-files/web-demuxer.wasm",
    });


    await demuxer.load(file);

    const reader = demuxer.read('video', 0).getReader()

    const chunks:EncodedAudioChunk[] = [];

    await new Promise(function(resolve){

        reader.read().then(async function processPacket(result: ReadableStreamReadResult<EncodedVideoChunk>): Promise<void> {
            const {done, value} = result;
            if(value) chunks.push(value);
            if(done) return resolve(chunks);
            return reader.read().then(processPacket)
        });

   });

   const mediaInfo = await demuxer.getMediaInfo();
   const videoTrack = mediaInfo.streams.filter((s)=>s.codec_type_string === 'video')[0];
   
   
   const config: VideoDecoderConfig= {
       codec: videoTrack.codec_string,
       codedWidth: videoTrack.width,
       codedHeight: videoTrack.height,
       description: videoTrack.extradata,
   }

   return {
    chunks,
    config
   }
   
}


export async function getAudioChunks(file: File): Promise<EncodedAudioChunk[]> {
    showDemoWarning();

    const demuxer = new WebDemuxer({
        wasmFilePath: "https://cdn.jsdelivr.net/npm/web-demuxer@latest/dist/wasm-files/web-demuxer.wasm",
    });


    await demuxer.load(file);

    const reader = demuxer.read('audio', 0).getReader()

    const chunks:EncodedAudioChunk[] = [];

    return new Promise(function(resolve){

        reader.read().then(async function processPacket(result: ReadableStreamReadResult<EncodedAudioChunk>): Promise<void> {
            const {done, value} = result;
            if(value) chunks.push(value);
            if(done) return resolve(chunks);
            return reader.read().then(processPacket)
        });

   });

}