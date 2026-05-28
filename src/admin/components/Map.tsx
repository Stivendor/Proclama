import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LATAM_COORDINATES, COUNTRY_CENTERS } from "@/constants/latamCoordinates";

// Corrige los iconos por defecto de Leaflet que a veces fallan al compilar
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.3.1/images/marker-shadow.png",
});

export interface UserLocationData {
  city: string;
  country: string;
  count: number;
}

interface MapProps {
  locations: UserLocationData[];
}

export default function Map({ locations }: MapProps) {
  // Asegura que Leaflet recalcule el tamaño del contenedor al montarse
  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "350px", position: "relative" }}>
      <MapContainer
        center={[4.5709, -74.2973]} // Centrado en LatAm
        zoom={3}
        scrollWheelZoom={false}
        style={{ width: "100%", height: "100%", borderRadius: "12px", background: "#0a0a0f" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {locations.map((loc, idx) => {
          const key = `${loc.city}, ${loc.country}`;
          let coordinates = LATAM_COORDINATES[key];

          // Fallback a centro del país si no se tiene la coordenada específica de la ciudad
          if (!coordinates && loc.country) {
            coordinates = COUNTRY_CENTERS[loc.country];
          }

          // Si aún no hay coordenadas (ej. ubicación vacía u otro país desconocido), omitimos graficar
          if (!coordinates) return null;

          // Cálculo proporcional del radio de la burbuja
          const radius = Math.max(6, Math.min(30, 6 + loc.count * 2.2));

          return (
            <CircleMarker
              key={`${key}-${idx}`}
              center={coordinates}
              radius={radius}
              pathOptions={{
                color: "#c9a658",       // Borde dorado
                fillColor: "#c9a658",   // Relleno dorado
                fillOpacity: 0.35,       // Transparencia premium
                weight: 1.5,
              }}
            >
              <Popup>
                <div style={{ 
                  color: "#ffffff", 
                  fontFamily: "'Montserrat', sans-serif", 
                  fontSize: "12px", 
                  lineHeight: "1.4"
                }}>
                  <strong style={{ color: "#c9a658", display: "block", fontSize: "13px", marginBottom: "4px" }}>
                    {loc.city || "Ciudad no especificada"}, {loc.country}
                  </strong>
                  <span>📍 {loc.count} {loc.count === 1 ? "usuario registrado" : "usuarios registrados"}</span>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <style>{`
        /* Sobrescribir estilos de Leaflet para integrarse con Proclama Gold & Black */
        .leaflet-container {
          font-family: 'Montserrat', sans-serif !important;
        }
        .leaflet-popup-content-wrapper {
          background: #0f131c !important;
          border: 1px solid rgba(201, 166, 88, 0.25) !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6) !important;
        }
        .leaflet-popup-tip {
          background: #0f131c !important;
          border-left: 1px solid rgba(201, 166, 88, 0.2) !important;
          border-bottom: 1px solid rgba(201, 166, 88, 0.2) !important;
        }
        .leaflet-container a.leaflet-popup-close-button {
          color: #8b98b0 !important;
          padding: 8px 8px 0 0 !important;
        }
        .leaflet-container a.leaflet-popup-close-button:hover {
          color: #c9a658 !important;
        }
        .leaflet-bar {
          border: 1px solid rgba(201, 166, 88, 0.15) !important;
          box-shadow: none !important;
          border-radius: 6px !important;
          overflow: hidden;
        }
        .leaflet-bar a {
          background-color: #0f131c !important;
          color: #ffffff !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          transition: background-color 0.2s, color 0.2s;
        }
        .leaflet-bar a:hover {
          background-color: rgba(201, 166, 88, 0.1) !important;
          color: #c9a658 !important;
        }
      `}</style>
    </div>
  );
}
