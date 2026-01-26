import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState, useCallback } from 'react';
import addTileLayer from "./components/Tile";

export default function Dashboard() {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const stormLayerRef = useRef(null);
    const lightningLayerRef = useRef(null);
    
    // State
    const [simData, setSimData] = useState(null);
    const [currentTick, setCurrentTick] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null); 
    const [playbackSpeed, setPlaybackSpeed] = useState(100);
    
    // Inputs
    const [seedInput, setSeedInput] = useState('12345'); 
    const [portInput, setPortInput] = useState('3001');

    // --- Helpers for Radar Visualization ---
    const getRadarColors = (intensity) => {
        const colors = {
            lightGreen: 'rgba(0, 255, 0, 0.4)',
            darkGreen:  'rgba(0, 180, 0, 0.6)',
            yellow:     'rgba(255, 255, 0, 0.7)',
            orange:     'rgba(255, 140, 0, 0.8)',
            red:        'rgba(255, 0, 0, 0.9)',
            purple:     'rgba(180, 0, 180, 1.0)' 
        };

        if (intensity < 0.3) return [colors.lightGreen, colors.lightGreen, colors.darkGreen];
        if (intensity < 0.5) return [colors.lightGreen, colors.darkGreen, colors.yellow];
        if (intensity < 0.7) return [colors.darkGreen, colors.yellow, colors.orange];
        if (intensity < 0.9) return [colors.yellow, colors.orange, colors.red];
        return [colors.orange, colors.red, colors.purple];
    };

    // --- Map Initialization ---
    useEffect(() => {
        if (mapInstanceRef.current) return;

        const map = L.map(mapContainerRef.current, {
            attributionControl: false,
            zoomControl: false,
            touchZoom: 'center',
            scrollWheelZoom: true,
            minZoom: 6,
        }).setView([27.8, -83.5], 7);

        addTileLayer(map);

        map.createPane('radarPane');
        map.getPane('radarPane').style.zIndex = 450; 
        
        map.createPane('lightningPane');
        map.getPane('lightningPane').style.zIndex = 650;

        stormLayerRef.current = L.layerGroup([], { pane: 'radarPane' }).addTo(map);
        lightningLayerRef.current = L.layerGroup([], { pane: 'lightningPane' }).addTo(map);

        mapInstanceRef.current = map;

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    // --- Render Logic ---
    const renderTick = useCallback((tickData) => {
        if (!mapInstanceRef.current || !stormLayerRef.current) return;

        stormLayerRef.current.clearLayers();
        lightningLayerRef.current.clearLayers();

        // FIX: Safe access to handle different JSON structures
        // Prioritizes direct access (new format), falls back to nested (old format), then empty array
        const cells = tickData.cells || (tickData.weather && tickData.weather.cells) || [];
        const lightning = tickData.lightning || (tickData.weather && tickData.weather.lightning) || [];

        cells.forEach(cell => {
            const center = [cell.lat, cell.lon];
            const baseRadiusMeters = cell.radius * 1000; 
            const colors = getRadarColors(cell.intensity);

            L.circle(center, { radius: baseRadiusMeters * 1.2, stroke: false, fillColor: colors[0], fillOpacity: 1, pane: 'radarPane', interactive: false }).addTo(stormLayerRef.current);
            L.circle(center, { radius: baseRadiusMeters * 0.7, stroke: false, fillColor: colors[1], fillOpacity: 1, pane: 'radarPane', interactive: false }).addTo(stormLayerRef.current);
            L.circle(center, { radius: baseRadiusMeters * 0.3, stroke: false, fillColor: colors[2], fillOpacity: 1, pane: 'radarPane', interactive: false }).addTo(stormLayerRef.current);
        });

        lightning.forEach(strike => {
            L.polyline(strike.path, { color: '#FFFFFF', weight: 3, opacity: 1, pane: 'lightningPane' }).addTo(lightningLayerRef.current);
        });
    }, []);

    // --- Fetch Data ---
    const fetchSimulation = async (seedToUse, portToUse) => {
        setLoading(true);
        setErrorMsg(null);
        setSimData(null);
        setIsPlaying(false);
        
        const baseUrl = `http://localhost:${portToUse}`;
        const url = `${baseUrl}/api/simulation/${seedToUse}`;
        
        console.log(`Looking up simulation: ${url}`);

        try {
            const res = await fetch(url);
            
            if (res.status === 404) {
                throw new Error("Simulation not found.");
            }
            if (!res.ok) {
                throw new Error(`Server Error: ${res.statusText}`);
            }
            
            const json = await res.json();
            
            if (!json || !json.data) {
                throw new Error("Simulation data is null or invalid.");
            }

            setSimData(json.data);
            setCurrentTick(0); 
            setIsPlaying(true); 
            
        } catch (err) {
            console.error("Lookup failed:", err);
            setErrorMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Initial Load
    useEffect(() => {
        if(seedInput && portInput) {
            fetchSimulation(seedInput, portInput);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); 

    // --- Animation Loop ---
    useEffect(() => {
        let intervalId;
        if (isPlaying && simData && currentTick < simData.length) {
            intervalId = setInterval(() => {
                renderTick(simData[currentTick]);
                
                setCurrentTick(prev => {
                    if (prev >= simData.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, playbackSpeed);
        }
        return () => clearInterval(intervalId);
    }, [isPlaying, simData, currentTick, playbackSpeed, renderTick]);


    return (
        <div style={{ position: 'relative', height: "100vh", width: "100vw", background: '#0a0a0a' }}>
            <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />
            
            {/* Controls Overlay */}
            <div style={{
                position: 'absolute', top: 20, right: 20, zIndex: 1000,
                background: 'rgba(0,0,0,0.85)', padding: '20px', borderRadius: '12px', color: '#eee',
                border: '1px solid #333', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', minWidth: '250px'
            }}>
                <h3 style={{margin: '0 0 15px 0', color: '#FFD700', borderBottom: '1px solid #444', paddingBottom: '10px'}}>
                    Lightning Simulation ⚡
                </h3>
                
                {/* Inputs */}
                <div style={{marginBottom: '15px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap'}}>
                   <div style={{display:'flex', flexDirection:'column', gap:'2px'}}>
                        <label style={{fontSize:'0.7em', color:'#aaa'}}>Seed</label>
                        <input 
                            type="number" 
                            value={seedInput}
                            onChange={(e) => setSeedInput(e.target.value)}
                            placeholder="Seed"
                            style={inputStyle}
                        />
                   </div>
                   <div style={{display:'flex', flexDirection:'column', gap:'2px'}}>
                        <label style={{fontSize:'0.7em', color:'#aaa'}}>Port</label>
                        <input 
                            type="number" 
                            value={portInput}
                            onChange={(e) => setPortInput(e.target.value)}
                            placeholder="Port"
                            style={{...inputStyle, width: '60px'}}
                        />
                   </div>
                    
                    <button 
                        onClick={() => fetchSimulation(seedInput, portInput)} 
                        disabled={loading}
                        style={{
                            ...btnStyle, 
                            marginTop: '14px',
                            background: loading ? '#555' : '#007BFF', 
                            border: 'none',
                            flex: '0 0 auto'
                        }}
                    >
                        {loading ? '...' : 'Search'}
                    </button>
                </div>

                {/* Status Messages */}
                {loading && <div style={{color: '#00BFFF', marginBottom: '10px'}}>Searching local results...</div>}
                
                {errorMsg && (
                    <div style={{color: '#ff4444', marginBottom: '10px', fontSize: '0.9em', border: '1px solid #ff4444', padding: '8px', borderRadius: '4px', background:'rgba(50,0,0,0.5)'}}>
                        ⚠ {errorMsg}
                    </div>
                )}
                
                {/* Playback Controls */}
                {!loading && !errorMsg && simData && (
                    <div>
                        <div style={{marginBottom: '10px', fontSize: '1.1em', fontFamily: 'monospace'}}>
                            T+ {Math.floor((currentTick * 5) / 60).toString().padStart(2, '0')}:
                            {((currentTick * 5) % 60).toString().padStart(2, '0')} hrs
                        </div>
                        
                        <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
                             <button onClick={() => setIsPlaying(!isPlaying)} style={btnStyle}>
                                {isPlaying ? 'PAUSE' : 'PLAY'}
                            </button>
                            <button onClick={() => { setCurrentTick(0); renderTick(simData[0]); }} style={btnStyle}>
                                RESET
                            </button>
                        </div>
                        
                        <div>
                            <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', marginBottom: '4px'}}>
                                <label>Playback Speed</label>
                                <span>{playbackSpeed}ms</span>
                            </div>
                            <input 
                                type="range" min="20" max="200" step="10" 
                                value={playbackSpeed}
                                onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                                style={{width: '100%', accentColor: '#FFD700'}}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const inputStyle = {
    background: '#222', 
    border: '1px solid #555', 
    color: 'white', 
    padding: '6px', 
    borderRadius: '4px', 
    width: '80px'
};

const btnStyle = {
    cursor: 'pointer', 
    padding: '8px 16px', 
    background: '#333', 
    color: 'white', 
    border: '1px solid #555',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '0.9em',
    flex: 1
};