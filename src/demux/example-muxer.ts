import {
    EncodedPacket,
    EncodedVideoPacketSource,
    EncodedAudioPacketSource,
    BufferTarget,
    Mp4OutputFormat,
    Output
  } from 'mediabunny';


export class ExampleMuxer{

    type: 'audio' | 'video'
    output: Output
    source: EncodedVideoPacketSource | EncodedAudioPacketSource
    started: boolean;
    target: BufferTarget

    constructor(type?: 'audio'|'video'){
        this.type = type || 'video';

        this.target = new BufferTarget();

        const output = new Output({
            format: new Mp4OutputFormat(),
            target: this.target,
        });

        this.started  = false;

        this.output = output;
        
        this.source = this.type=== 'video'?  new EncodedVideoPacketSource('avc') : new EncodedAudioPacketSource('aac');
        this.output.addVideoTrack(this.source);

        
        console.warn(
            '⚠️  Demo/Learning Function: This utility is intended for demos and learning purposes only. ' +
            'For production use, please use a proper muxing library like MediaBunny (https://mediabunny.dev/) '
          );

    }

    addChunk(chunk: EncodedAudioChunk | EncodedVideoChunk, meta?: any){

        if(!this.started){
            this.output.start();
            this.started = true;
        }
        this.source.add(EncodedPacket.fromEncodedChunk(chunk), meta)
    }

    async finish(): Promise<ArrayBuffer>{
        await this.output.finalize();

        return <ArrayBuffer> this.target.buffer;


    }





}