import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

// Dummy elements for declarative use in parent views
export const Marker = (props) => null;
export const Polyline = (props) => null;

function MapMarker({ marker, scaleLng, scaleLat, mapWidth, mapHeight }) {
  const [hovered, setHovered] = React.useState(false);
  const x = `${((scaleLng(marker.lng) / mapWidth) * 100).toFixed(2)}%`;
  const y = `${((scaleLat(marker.lat) / mapHeight) * 100).toFixed(2)}%`;
  const pulseColor = marker.pinColor;

  return (
    <View
      style={[
        styles.markerContainer,
        { left: x, top: y, zIndex: hovered ? 999 : 10 }
      ]}
      // @ts-ignore - web only hover handlers
      onMouseEnter={() => setHovered(true)}
      // @ts-ignore - web only hover handlers
      onMouseLeave={() => setHovered(false)}
    >
      {/* Glowing Pulse */}
      <View style={[styles.pulse, { backgroundColor: pulseColor }]} />
      {/* Solid Pin Pinhead */}
      <View style={[styles.pin, { backgroundColor: pulseColor }]} />
      
      {/* Tooltip Label */}
      {hovered && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>{marker.title}</Text>
          {marker.description ? (
            <Text style={styles.tooltipDesc}>{marker.description}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function MapView({ children, style, initialRegion }) {
  // Extract markers and polylines from children
  const markers = [];
  let polylineCoords = [];

  React.Children.forEach(children, (child) => {
    if (!child) return;
    const typeName = child.type?.name || child.type?.displayName || "";
    if (child.props) {
      if (child.props.coordinate) {
        markers.push({
          id: child.key || Math.random().toString(),
          lat: child.props.coordinate.latitude,
          lng: child.props.coordinate.longitude,
          pinColor: child.props.pinColor || colors.primary,
          title: child.props.title,
          description: child.props.description,
        });
      } else if (child.props.coordinates) {
        polylineCoords = child.props.coordinates.map((c) => ({
          lat: c.latitude,
          lng: c.longitude,
        }));
      }
    }
  });

  // Determine bounds
  let minLat = 18.545;
  let maxLat = 18.575;
  let minLng = 73.785;
  let maxLng = 73.815;

  const allPoints = [...markers, ...polylineCoords];
  if (allPoints.length > 0) {
    minLat = Math.min(...allPoints.map((p) => p.lat));
    maxLat = Math.max(...allPoints.map((p) => p.lat));
    minLng = Math.min(...allPoints.map((p) => p.lng));
    maxLng = Math.max(...allPoints.map((p) => p.lng));
  }

  // Padding to ensure dots aren't clipped on edges
  const latDelta = Math.max(maxLat - minLat, 0.005);
  const lngDelta = Math.max(maxLng - minLng, 0.005);

  const padLatMin = minLat - latDelta * 0.1;
  const padLatMax = maxLat + latDelta * 0.1;
  const padLngMin = minLng - lngDelta * 0.1;
  const padLngMax = maxLng + lngDelta * 0.1;

  const latRange = padLatMax - padLatMin;
  const lngRange = padLngMax - padLngMin;

  const mapWidth = 350; // Reference width for SVG/relative coordinates
  const mapHeight = 240;

  const scaleLng = (lng) => {
    return ((lng - padLngMin) / lngRange) * mapWidth;
  };

  // Inverted because screen coordinates go top-down
  const scaleLat = (lat) => {
    return mapHeight - ((lat - padLatMin) / latRange) * mapHeight;
  };

  // Render SVG Polyline
  const pointsString = polylineCoords
    .map((c) => `${scaleLng(c.lng).toFixed(1)},${scaleLat(c.lat).toFixed(1)}`)
    .join(" ");

  return (
    <View style={[styles.container, style]}>
      {/* Visual background elements */}
      <View style={styles.gridLines}>
        <View style={[styles.gridRow, { top: "25%" }]} />
        <View style={[styles.gridRow, { top: "50%" }]} />
        <View style={[styles.gridRow, { top: "75%" }]} />
        <View style={[styles.gridCol, { left: "25%" }]} />
        <View style={[styles.gridCol, { left: "50%" }]} />
        <View style={[styles.gridCol, { left: "75%" }]} />
      </View>

      <Text style={styles.watermark}>ROUTEGENIE RADAR VIEW</Text>

      {/* SVG Canvas for route lines */}
      {polylineCoords.length > 0 && (
        <svg
          style={styles.svg}
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          width="100%"
          height="100%"
        >
          <polyline
            points={pointsString}
            fill="none"
            stroke={colors.primary}
            strokeWidth="3"
            strokeDasharray="5,5"
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Plot markers */}
      {markers.map((marker) => (
        <MapMarker
          key={marker.id}
          marker={marker}
          scaleLng={scaleLng}
          scaleLat={scaleLat}
          mapWidth={mapWidth}
          mapHeight={mapHeight}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 260,
    backgroundColor: "#0F172A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    position: "relative",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  gridLines: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.15,
    justifyContent: "space-between",
  },
  gridRow: {
    height: 1,
    backgroundColor: "#94A3B8",
    width: "100%",
  },
  gridCol: {
    width: 1,
    backgroundColor: "#94A3B8",
    height: "100%",
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  watermark: {
    position: "absolute",
    bottom: 8,
    right: 12,
    fontSize: 10,
    color: "#475569",
    fontWeight: "700",
    letterSpacing: 1,
  },
  svg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  markerContainer: {
    position: "absolute",
    width: 16,
    height: 16,
    marginLeft: -8,
    marginTop: -8,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  pin: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    zIndex: 2,
  },
  pulse: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    opacity: 0.4,
    transform: [{ scale: 1.2 }],
    zIndex: 1,
  },
  tooltip: {
    position: "absolute",
    bottom: 18,
    backgroundColor: "#1E293B",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#475569",
    minWidth: 80,
    alignItems: "center",
    opacity: 0.85,
    pointerEvents: "none",
  },
  tooltipTitle: {
    color: "#F8FAFC",
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "center",
  },
  tooltipDesc: {
    color: "#94A3B8",
    fontSize: 7,
    textAlign: "center",
  },
});
