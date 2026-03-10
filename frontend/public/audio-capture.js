/**
 * Mic capture AudioWorklet — from Google's official adk-samples/bidi-demo.
 * Simply forwards Float32 samples to the main thread.
 * Main thread handles Float32 → Int16 conversion.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }
  process(inputs, outputs, parameters) {
    if (inputs.length > 0 && inputs[0].length > 0) {
      const inputChannel = inputs[0][0];
      const inputCopy = new Float32Array(inputChannel);
      this.port.postMessage(inputCopy);
    }
    return true;
  }
}
registerProcessor("pcm-recorder-processor", PCMProcessor);
