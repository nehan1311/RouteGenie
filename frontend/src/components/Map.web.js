import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";

// Marker and Polyline are dummy components on Web, 
// MapView parses their props using React.Children
export const Marker = () => null;
export const Polyline = () => null;

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

export default function MapView({ children, style }) {
  const { markers, polylineCoords } = getChildMapData(children);

  // We build a self-contained Leaflet HTML/JS document to render inside the iframe.
  // This guarantees perfect coordinate alignment between the map tiles and the markers/polyline overlays,
  // resolving the misalignment issue where percentage-based overlays didn't match OSM discrete zoom levels.
  const leafletSrcDoc = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>
        html, body, #map {
          height: 100%;
          margin: 0;
          padding: 0;
          background-color: #0F1117;
        }
        .custom-tooltip {
          background-color: #111111 !important;
          color: #ffffff !important;
          border: none !important;
          border-radius: 8px !important;
          padding: 8px 10px !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 11px !important;
          font-weight: 700;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          opacity: 0.95 !important;
        }
        .custom-tooltip::before {
          border-top-color: #111111 !important;
        }
        .leaflet-control-attribution {
          font-size: 9px !important;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script>
        var map = L.map('map', {
          zoomControl: true,
          scrollWheelZoom: true
        }).setView([19.1136, 72.8697], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>'
        }).addTo(map);

        var markersData = ${JSON.stringify(markers)};
        var polylineData = ${JSON.stringify(polylineCoords)};

        var bounds = [];

        // Add polyline if present
        if (polylineData.length > 1) {
          var latlngs = polylineData.map(function(pt) {
            return [pt.lat, pt.lng];
          });
          var polyline = L.polyline(latlngs, {
            color: '#635BDF',
            weight: 4,
            dashArray: '7, 7',
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(map);
          
          polylineData.forEach(function(pt) {
            bounds.push([pt.lat, pt.lng]);
          });
        }

        // Add markers
        markersData.forEach(function(m) {
          if (!m.lat || !m.lng) return;
          bounds.push([m.lat, m.lng]);

          var markerHtml = '<div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">' +
            '<div style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background-color: ' + m.pinColor + '; opacity: 0.24;"></div>' +
            '<div style="position: absolute; width: 12px; height: 12px; border-radius: 50%; background-color: ' + m.pinColor + '; border: 2px solid #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>' +
            '</div>';

          var customIcon = L.divIcon({
            html: markerHtml,
            className: 'custom-marker-icon',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          var marker = L.marker([m.lat, m.lng], { icon: customIcon }).addTo(map);

          var tooltipText = '<b>' + m.title + '</b>';
          if (m.description) {
            tooltipText += '<br/><span style="font-weight: 500; opacity: 0.85; font-size: 9px;">' + m.description + '</span>';
          }

          marker.bindTooltip(tooltipText, {
            direction: 'top',
            offset: [0, -10],
            className: 'custom-tooltip'
          });
        });

        // Fit map bounds to show all markers/polylines
        if (bounds.length > 0) {
          map.fitBounds(bounds, {
            padding: [30, 30],
            maxZoom: 16
          });
        }
      </script>
    </body>
    </html>
  `;

  return (
    <View style={[styles.container, style]}>
      {React.createElement("iframe", {
        srcDoc: leafletSrcDoc,
        title: "RouteGenie live map",
        style: styles.iframe,
        loading: "lazy",
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
