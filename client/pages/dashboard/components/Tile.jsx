import L from "leaflet"; 

export default function addTileLayer(map) {
    L.tileLayer('https://api.warn.live/{z}/{x}/{y}.png').addTo(map);
}