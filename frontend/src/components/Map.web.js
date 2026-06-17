import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export const Marker = () => null;
export const Polyline = () => null;

const MAP_WIDTH = 350;
const MAP_HEIGHT = 240;

function getChildMapData(children) {
  const markers = [];
  let polylineCoords = [];

  React.Children.forEach(children, (child) => {
    if (!child?.props) return;

    if (child.props.coordinate) {
      markers.push({
        id: child.key || `${child.props.coordinate.latitude}-${child.props.coordinate.longitude}`,
        lat: Number(child.props.coordinate.latitude),
        lng: Number(child.props.coordinate.longitude),
        pinColor: child.props.pinColor || colors.primary,
        title: child.props.title,
        description: child.props.description,
      });
    }

    if (child.props.coordinates) {
      polylineCoords = child.props.coordinates.map((coordinate) => ({
        lat: Number(coordinate.latitude),
        lng: Number(coordinate.longitude),
      }));
    }
  });

  return { markers, polylineCoords };
}

function getBounds(points, initialRegion) {
  if (points.length === 0 && initialRegion) {
    const latDelta = initialRegion.latitudeDelta || 0.04;
    const lngDelta = initialRegion.longitudeDelta || 0.04;
    return {
      minLat: initialRegion.latitude - latDelta / 2,
      maxLat: initialRegion.latitude + latDelta / 2,
      minLng: initialRegion.longitude - lngDelta / 2,
      maxLng: initialRegion.longitude + lngDelta / 2,
    };
  }

  let minLat = points.length ? Math.min(...points.map((point) => point.lat)) : 18.545;
  let maxLat = points.length ? Math.max(...points.map((point) => point.lat)) : 18.575;
  let minLng = points.length ? Math.min(...points.map((point) => point.lng)) : 73.785;
  let maxLng = points.length ? Math.max(...points.map((point) => point.lng)) : 73.815;

  const latDelta = Math.max(maxLat - minLat, 0.01);
  const lngDelta = Math.max(maxLng - minLng, 0.01);

  minLat -= latDelta * 0.25;
  maxLat += latDelta * 0.25;
  minLng -= lngDelta * 0.25;
  maxLng += lngDelta * 0.25;

  return { minLat, maxLat, minLng, maxLng };
}

function scalePoint(point, bounds) {
  const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.0001);
  const lngRange = Math.max(bounds.maxLng - bounds.minLng, 0.0001);

  return {
    x: ((point.lng - bounds.minLng) / lngRange) * MAP_WIDTH,
    y: MAP_HEIGHT - ((point.lat - bounds.minLat) / latRange) * MAP_HEIGHT,
  };
}

function MapMarker({ marker, bounds }) {
  const [hovered, setHovered] = React.useState(false);
  const point = scalePoint(marker, bounds);
  const left = `${((point.x / MAP_WIDTH) * 100).toFixed(2)}%`;
  const top = `${((point.y / MAP_HEIGHT) * 100).toFixed(2)}%`;

  return (
    <View
      style={[styles.markerContainer, { left, top, zIndex: hovered ? 100 : 10 }]}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <View style={[styles.markerHalo, { backgroundColor: marker.pinColor }]} />
      <View style={[styles.markerPin, { backgroundColor: marker.pinColor }]} />
      {hovered ? (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>{marker.title}</Text>
          {marker.description ? <Text style={styles.tooltipDesc}>{marker.description}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function RouteLine({ coordinates, bounds }) {
  if (coordinates.length < 2) return null;

  const points = coordinates
    .map((coordinate) => {
      const point = scalePoint(coordinate, bounds);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg style={styles.svg} viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} width="100%" height="100%">
      <polyline
        points={points}
        fill="none"
        stroke="#635BDF"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="7,7"
      />
    </svg>
  );
}

export default function MapView({ children, style, initialRegion }) {
  const { markers, polylineCoords } = getChildMapData(children);
  const bounds = getBounds([...markers, ...polylineCoords], initialRegion);
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat}&layer=mapnik`;

  return (
    <View style={[styles.container, style]}>
      {React.createElement("iframe", {
        src: mapUrl,
        title: "RouteGenie live map",
        style: styles.iframe,
        loading: "lazy",
      })}
      <View pointerEvents="none" style={styles.tint} />
      <RouteLine coordinates={polylineCoords} bounds={bounds} />
      {markers.map((marker) => (
        <MapMarker key={marker.id} marker={marker} bounds={bounds} />
      ))}
      <View style={styles.mapBadge}>
        <Text style={styles.mapBadgeText}>LIVE MAP</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 280,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8D4CB",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#E8ECEF",
  },
  iframe: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    borderWidth: 0,
    borderStyle: "none",
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  svg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    pointerEvents: "none",
  },
  markerContainer: {
    position: "absolute",
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    alignItems: "center",
    justifyContent: "center",
  },
  markerHalo: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    opacity: 0.24,
  },
  markerPin: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#111111",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  tooltip: {
    position: "absolute",
    bottom: 26,
    minWidth: 120,
    maxWidth: 180,
    backgroundColor: "#111111",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    shadowColor: "#111111",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  tooltipTitle: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center",
  },
  tooltipDesc: {
    color: "#D8D4CB",
    fontSize: 9,
    textAlign: "center",
    marginTop: 2,
  },
  mapBadge: {
    position: "absolute",
    left: 12,
    top: 12,
    borderRadius: 999,
    backgroundColor: "rgba(17, 17, 17, 0.82)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mapBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0,
  },
});
