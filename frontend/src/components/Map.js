import React from "react";
import MapViewNative, { Marker, Polyline } from "react-native-maps";

export default function MapView({ onMapClick, ...props }) {
  return (
    <MapViewNative
      {...props}
      onPress={onMapClick ? (e) => onMapClick(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude) : undefined}
    />
  );
}
export { Marker, Polyline };
