import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";

export const Marker = () => null;
export const Polyline = () => null;

function walkMapChildren(children, markers, polylines) {
  React.Children.forEach(children, (child) => {
    if (!child) return;

    if (Array.isArray(child)) {
      walkMapChildren(child, markers, polylines);
      return;
    }

    if (!child.props) return;

    if (child.props.coordinate) {
      markers.push({
        id: child.key || `${child.props.coordinate.latitude}-${child.props.coordinate.longitude}`,
        lat: Number(child.props.coordinate.latitude),
        lng: Number(child.props.coordinate.longitude),
        pinColor: String(child.props.pinColor || colors.primary),
        title: String(child.props.title || ""),
        description: String(child.props.description || ""),
      });
    }

    if (child.props.coordinates?.length) {
      polylines.push({
        coords: child.props.coordinates.map((coordinate) => ({
          lat: Number(coordinate.latitude),
          lng: Number(coordinate.longitude),
        })),
        color: String(child.props.strokeColor || colors.primary),
      });
    }

    if (child.props.children) {
      walkMapChildren(child.props.children, markers, polylines);
    }
  });
}

function getChildMapData(children) {
  const markers = [];
  const polylines = [];
  walkMapChildren(children, markers, polylines);
  return { markers, polylines };
}

function buildLeafletDoc(markers, polylines) {
  const markersJson = JSON.stringify(markers);
  const polylinesJson = JSON.stringify(polylines);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; background: #0F1117; }
    .custom-tooltip {
      background: #111 !important; color: #fff !important; border: none !important;
      border-radius: 8px !important; padding: 8px 10px !important;
      font: 700 11px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .leaflet-control-attribution { font-size: 9px !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      var markersData = ${markersJson};
      var polylinesData = ${polylinesJson};

      function boot() {
        if (typeof window.L === "undefined") {
          setTimeout(boot, 40);
          return;
        }
        var L = window.L;
        var map = L.map("map", { zoomControl: true, scrollWheelZoom: true }).setView([19.1136, 72.8697], 14);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap"
        }).addTo(map);

        map.on("click", function(e) {
          window.parent.postMessage({ type: "MAP_CLICK", lat: e.latlng.lat, lng: e.latlng.lng }, "*");
        });

        var bounds = [];

        polylinesData.forEach(function(line) {
          if (!line.coords || line.coords.length < 2) return;
          var latlngs = line.coords.map(function(pt) { return [pt.lat, pt.lng]; });
          L.polyline(latlngs, {
            color: line.color || "#635BDF",
            weight: 4,
            dashArray: "7, 7",
            lineCap: "round",
            lineJoin: "round"
          }).addTo(map);
          line.coords.forEach(function(pt) { bounds.push([pt.lat, pt.lng]); });
        });

        markersData.forEach(function(m) {
          if (!m.lat || !m.lng) return;
          bounds.push([m.lat, m.lng]);
          var html = '<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;">'
            + '<div style="position:absolute;width:24px;height:24px;border-radius:50%;background:' + m.pinColor + ';opacity:0.24;"></div>'
            + '<div style="position:absolute;width:12px;height:12px;border-radius:50%;background:' + m.pinColor + ';border:2px solid #fff;"></div></div>';
          var icon = L.divIcon({ html: html, className: "", iconSize: [24, 24], iconAnchor: [12, 12] });
          var marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
          var tip = "<b>" + (m.title || "") + "</b>";
          if (m.description) tip += "<br/><span style='opacity:0.85;font-size:9px'>" + m.description + "</span>";
          marker.bindTooltip(tip, { direction: "top", offset: [0, -10], className: "custom-tooltip" });
        });

        if (bounds.length > 1) {
          map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
        } else if (bounds.length === 1) {
          map.setView(bounds[0], 15);
        }
      }

      var script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.crossOrigin = "";
      script.onload = boot;
      script.onerror = function() { document.getElementById("map").innerHTML = "<p style='color:#888;padding:16px'>Map unavailable</p>"; };
      document.body.appendChild(script);
    })();
  </script>
</body>
</html>`;
}

export default function MapView({ children, style, onMapClick }) {
  const { markers, polylines } = getChildMapData(children);
  const mapKey = useMemo(
    () => `${markers.length}-${polylines.length}-${markers.map((m) => m.id).join(",")}`,
    [markers, polylines]
  );
  const leafletSrcDoc = useMemo(() => buildLeafletDoc(markers, polylines), [mapKey, markers, polylines]);

  useEffect(() => {
    function handleMessage(event) {
      if (event.data?.type === "MAP_CLICK" && onMapClick) {
        onMapClick(event.data.lat, event.data.lng);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onMapClick]);

  return (
    <View style={[styles.container, style]}>
      {React.createElement("iframe", {
        key: mapKey,
        srcDoc: leafletSrcDoc,
        title: "RouteGenie live map",
        style: styles.iframe,
        sandbox: "allow-scripts allow-same-origin",
      })}
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
});
