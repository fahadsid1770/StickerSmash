import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { 
  Camera, 
  useCameraDevice, 
  useFrameProcessor, 
  runAtTargetFps 
} from "react-native-vision-camera";
import { useSharedValue } from "react-native-worklets-core";

export default function VisionCamera() {
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [permission, setPermission] = useState<boolean | null>(null);
  const [displayBits, setDisplayBits] = useState("Scanning...");
  
  const detectedBits = useSharedValue("Scanning...");
  const device = useCameraDevice(facing);

  
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setPermission(status === "granted");
    })();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayBits(detectedBits.value);
    }, 200);
    return () => clearInterval(interval);
  }, [detectedBits]);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';

    //Running 15-30 FPS to save battery, although Rolling Shutter capture happens at the sensor read speed.
    runAtTargetFps(15, () => {
      'worklet';
      
      //we only need the Y (Luminance) plane.
      if (frame.pixelFormat !== 'yuv') return;


      try {
        const buffer = frame.toArrayBuffer();
        const data = new Uint8Array(buffer);

      const width = frame.width;
      const height = frame.height;
      const stride = frame.bytesPerRow;

      // going to analyze only the CENTER COLUMN of the image.
      // The Rolling Shutter means the top pixel is captured earlier than the bottom pixel.
      // This column represents "Time".
      const centerX = Math.floor(width / 2);
      
      // Arrays to hold our luminance samples
      let luminanceSum = 0;
      let samples: number[] = [];

      for (let y = 0; y < height; y++) {
        // Calculate index for the pixel at (centerX, y) Y-plane data is at the start of the buffer.
        const index = y * stride + centerX;
        
        if (index < data.length && index >= 0) {
          const luminance = data[index];
          samples.push(luminance);
          luminanceSum += luminance;
        }
      }

  
      const threshold = luminanceSum / samples.length;
      let binaryString = "";
      const resolutionDivisor = 10; 
      
      for (let i = 0; i < samples.length; i += resolutionDivisor) {
        const val = samples[i];
        // Simple threshold logic
        binaryString += val > threshold ? "|" : ".";
      }

      detectedBits.value = binaryString.substring(0, 50); // Show first 50 chunks
      } catch (error) {
        // Handle any frame processing errors gracefully
        detectedBits.value = "Processing error";
      }
    });
  }, [detectedBits]);

  if (permission === null) return <View style={styles.container} />;
  if (permission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission denied</Text>
        <TouchableOpacity 
          style={styles.permissionButton} 
          onPress={async () => {
            const status = await Camera.requestCameraPermission();
            setPermission(status === "granted");
          }}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>No Camera Device Found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={styles.camera}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        pixelFormat="yuv"
        exposure={-1}
      />
      
      <View style={styles.overlay}>
        <View style={styles.dataBox}>
          <Text style={styles.label}>Rolling Shutter Stream:</Text>
          <Text style={styles.binaryData}>{displayBits}</Text>
          <Text style={styles.hint}>"|" = Light, "." = Dark</Text>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => setFacing(f => f === 'back' ? 'front' : 'back')}
          >
            <Text style={styles.buttonText}>Flip Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#000" 
  },
  camera: { 
    flex: 1 
  },
  overlay: {
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0,
    padding: 20, 
    paddingBottom: 50,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center'
  },
  dataBox: {
    width: '100%', 
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 15, 
    borderRadius: 10, 
    marginBottom: 20,
  },
  label: { 
    color: '#aaa', 
    fontSize: 12, 
    marginBottom: 5 
  },
  binaryData: { 
    color: '#0f0', 
    fontSize: 16, 
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 2 
  },
  hint: { 
    color: '#666', 
    fontSize: 10, 
    marginTop: 5, 
    textAlign: 'right' 
  },
  buttonContainer: { 
    flexDirection: "row", 
    justifyContent: "center" 
  },
  button: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 20, 
    paddingVertical: 12,
    borderRadius: 25, 
    borderWidth: 1, 
    borderColor: "#fff",
  },
  buttonText: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "600" 
  },
  permissionText: { 
    color: "#fff", 
    fontSize: 18, 
    textAlign: "center", 
    marginTop: 100,
    paddingHorizontal: 20
  },
  permissionButton: { 
    marginTop: 20, 
    alignSelf: 'center', 
    padding: 15,
    paddingHorizontal: 30, 
    backgroundColor: '#4CAF50', 
    borderRadius: 8 
  },
  permissionButtonText: { 
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  }
});