// ===== DATASET GAMMA COMPLETO =====

// ===== CREDENCIALES DE AUTENTICACIÓN =====
const VALID_CREDENTIALS = {
    'Usuario 007': 'Swordfish123',
    'Alejandro': 'Arjona'
};

// ===== CONFIGURACIÓN DE COLORES POR AÑO =====
const YEAR_COLORS = {
    2018: '#2C3E50', // Negro/gris oscuro
    2019: '#27AE60', // Verde
    2020: '#3498DB', // Azul
    2021: '#F1C40F', // Amarillo
    2022: '#E67E22', // Naranja
    2023: '#9B59B6', // Morado
    2024: '#95A5A6', // Gris
    2025: '#E74C3C', // Rojo
    '2025p': '#000000' // Negro para estrellas 2025p
};

// ===== VARIABLES GLOBALES =====
let map;
let allData = [];
let filteredData = [];
let markersLayer;
let starsLayer2025p; // Nueva capa para estrellas 2025p
let heatmapConcentracion;
let heatmapVictimas;
let municipalBordersLayer;
let municipioChart;
let anualChart;
let fosasChart;
let fosasAnualChart;

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', function() {
    initializeAuth();
    
    // Inicializar con datos vacíos - se cargarán desde Google Sheets después del login
    allData = [];
    filteredData = [];
    
    console.log('Sistema BETA inicializado - esperando carga de datos desde Google Sheets');
});

// ===== AUTENTICACIÓN =====
function initializeAuth() {
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (VALID_CREDENTIALS[username] === password) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('currentUser').textContent = username;
        
        // Inicializar aplicación
        initializeApp();
        
        console.log('Login exitoso para:', username);
    } else {
        alert('Credenciales incorrectas. Solicita ayuda al administrador');
    }
}

function handleLogout() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// ===== INICIALIZACIÓN DE LA APLICACIÓN =====
// Debounce helper para optimizar event listeners
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function initializeApp() {
    // Inicializar mapa y filtros de forma rápida
    initializeMap();
    populateFilters();
    setupEventListeners();
    
    // Lazy load: Inicializar tabla dinámica después de que el DOM esté listo
    setTimeout(() => {
        initializePivotTable();
    }, 100);
    
    // Lazy load: Inicializar sistema de tiempo real después de un pequeño retraso
    setTimeout(() => {
        if (!realTimeManager) {
            realTimeManager = new RealTimeDataManager();
        }
    }, 200);
    
    console.log('✅ Aplicación inicializada - Sistema de tiempo real activo');
}

// ===== MAPA =====
function initializeMap() {
    // Crear mapa centrado en Jalisco
    map = L.map('map').setView([20.6597, -103.3496], 8);
    
    // Definir capas base
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    });
    
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri, Maxar, Earthstar Geographics'
    });
    
    const terrainLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri, HERE, Garmin, Intermap, increment P Corp.'
    });
    
    // Agregar capa base predeterminada (Relieve)
    terrainLayer.addTo(map);
    
    // Crear control de capas base
    const baseLayers = {
        "OSM": osmLayer,
        "Satelital": satelliteLayer,
        "Relieve": terrainLayer
    };
    
    // Guardar referencia a las capas base para uso posterior
    window.baseLayers = baseLayers;
    
    // Inicializar capas
    markersLayer = L.layerGroup().addTo(map);
    starsLayer2025p = L.layerGroup().addTo(map); // Nueva capa para estrellas 2025p
    
    // Agregar controles
    addHeatmapControl();
    
    // Cargar marcadores iniciales
    updateMapMarkers(allData);
    
    // Cargar bordes municipales
    loadMunicipalBorders();
}

function updateMapMarkers(data) {
    markersLayer.clearLayers();
    starsLayer2025p.clearLayers();
    
    // Obtener años seleccionados
    const selectedYears = getSelectedYears();
    
    // Obtener tipos de delito seleccionados
    const selectedDelitos = getSelectedDelitos();
    
    data.forEach(item => {
        // Filtrar registros sin coordenadas válidas (no mostrar en el mapa)
        if (!item.hasCoordinates || item.latitud === 0 || item.longitud === 0) {
            return;
        }
        
        // Manejar registros 2025p por separado (ya no se muestran)
        if (item.año === '2025p') {
            return;
        }
        
        // Solo mostrar marcadores de años seleccionados (excluyendo 2025p)
        if (!selectedYears.includes(item.año.toString())) {
            return;
        }
        
        // Filtrar por tipo de delito
        if (!isDelitoSelected(item.delito, selectedDelitos)) {
            return;
        }
        
        const color = YEAR_COLORS[item.año] || '#ff0000';
        
        // Determinar la forma del ícono según el tipo de delito
        let iconShape = '';
        const delito = (item.delito || '').toLowerCase().trim();
        
        if (delito.includes('violencia familiar')) {
            // Triángulo
            iconShape = `<div style="width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-bottom: 14px solid ${color}; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); position: relative; top: -2px;"></div>`;
        } else if (delito.includes('abuso sexual infantil')) {
            // Cuadrado
            iconShape = `<div style="background-color: ${color}; width: 12px; height: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`;
        } else if (delito.includes('violacion')) {
            // Círculo
            iconShape = `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`;
        } else if (delito.includes('feminicidio')) {
            // Estrella
            iconShape = `<div style="color: ${color}; font-size: 16px; text-shadow: 0 0 3px white, 0 0 5px white; font-weight: bold; line-height: 1;">★</div>`;
        } else {
            // Por defecto: círculo
            iconShape = `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`;
        }
        
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: iconShape,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
        
        const marker = L.marker([item.latitud, item.longitud], {
            icon: customIcon
        });
        
        const popupContent = `
            <div class="popup-content-compact">
                <h4>📍 ${item.municipio}</h4>
                <p><strong>🔢 Referencia:</strong> ${item.referencia}</p>
                <p><strong>👥 Víctimas:</strong> ${item.victimas}</p>
                <p><strong>📅 Año:</strong> ${item.año}</p>
                <p><strong>🚨 Delito:</strong> ${item.delito}</p>
                <p><strong>📍 Coordenadas:</strong> ${item.latitud.toFixed(4)}, ${item.longitud.toFixed(4)}</p>
                ${item.link ? `<p><strong>🔗 Fuente:</strong> <a href="${item.link}" target="_blank">Ver más información</a></p>` : ''}
            </div>
        `;
        
        marker.bindPopup(popupContent);
        markersLayer.addLayer(marker);
    });
}

// ===== FUNCIÓN PARA CREAR ESTRELLAS 2025P =====
function createStar2025p(item) {
    // Crear icono de estrella negra de 12px
    const starIcon = L.divIcon({
        className: 'star-marker-2025p',
        html: `<div style="color: #000000; font-size: 12px; text-shadow: 1px 1px 2px rgba(255,255,255,0.8);">★</div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });
    
    const marker = L.marker([item.latitud, item.longitud], {
        icon: starIcon
    });
    
    // Pop-up especial para 2025p con indicador visual
    const popupContent = `
        <div class="popup-content-compact">
            <h4>⭐ ${item.municipio} (2025p)</h4>
            <p><strong>🔢 Referencia:</strong> ${item.referencia}</p>
            <p><strong>👥 Víctimas:</strong> ${item.victimas}</p>
            <p><strong>📅 Año:</strong> ${item.año}</p>
            <p><strong>🚨 Delito:</strong> ${item.delito}</p>
            <p><strong>📍 Coordenadas:</strong> ${item.latitud.toFixed(4)}, ${item.longitud.toFixed(4)}</p>
            ${item.link ? `<p><strong>🔗 Fuente:</strong> <a href="${item.link}" target="_blank">Ver más información</a></p>` : ''}
        </div>
    `;
    
    marker.bindPopup(popupContent);
    starsLayer2025p.addLayer(marker);
}

// ===== CONTROLES DEL MAPA =====
function addHeatmapControl() {
    const heatmapControl = L.control({position: 'topright'});
    
    heatmapControl.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'leaflet-control-heatmap');
        
        div.innerHTML = `
            <h4>Mapa de Calor</h4>
            <div class="heatmap-container">
                <div class="checkbox-container">
                    <div class="checkbox-item">
                        <input type="checkbox" id="heatmapVictimas">
                        <label for="heatmapVictimas">Víctimas</label>
                    </div>
                    <div class="checkbox-item">
                        <input type="checkbox" id="municipalBorders" checked>
                        <label for="municipalBorders">Municipios</label>
                    </div>
                </div>
            </div>
            <h4>Mapa Base</h4>
            <div class="base-map-container">
                <div class="radio-container">
                    <div class="radio-item">
                        <input type="radio" id="baseOSM" name="baseLayer" value="OSM">
                        <label for="baseOSM">OSM</label>
                    </div>
                    <div class="radio-item">
                        <input type="radio" id="baseSatelital" name="baseLayer" value="Satelital">
                        <label for="baseSatelital">Satelital</label>
                    </div>
                    <div class="radio-item">
                        <input type="radio" id="baseRelieve" name="baseLayer" value="Relieve" checked>
                        <label for="baseRelieve">Relieve</label>
                    </div>
                </div>
            </div>
        `;
        
        return div;
    };
    
    heatmapControl.addTo(map);
    
    // Event listeners para checkboxes y radio buttons
    setTimeout(() => {
        document.getElementById('heatmapVictimas').addEventListener('change', toggleHeatmapVictimas);
        document.getElementById('municipalBorders').addEventListener('change', toggleMunicipalBorders);
        
        // Event listeners para radio buttons de mapa base
        document.getElementById('baseOSM').addEventListener('change', changeBaseLayer);
        document.getElementById('baseSatelital').addEventListener('change', changeBaseLayer);
        document.getElementById('baseRelieve').addEventListener('change', changeBaseLayer);
    }, 100);
}

// ===== MAPAS DE CALOR =====
function toggleHeatmapConcentracion() {
    const checkbox = document.getElementById('heatmapConcentracion');
    
    if (checkbox.checked) {
        if (heatmapConcentracion) {
            map.removeLayer(heatmapConcentracion);
        }
        
        const heatData = filteredData.map(item => [item.latitud, item.longitud, 1]);
        
        heatmapConcentracion = L.heatLayer(heatData, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            gradient: {0.4: 'blue', 0.65: 'lime', 1: 'red'}
        }).addTo(map);
        
        console.log('Mapa de calor de concentración activado');
    } else {
        if (heatmapConcentracion) {
            map.removeLayer(heatmapConcentracion);
            heatmapConcentracion = null;
        }
        
        console.log('Mapa de calor de concentración desactivado');
    }
}


////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////



function toggleHeatmapVictimas() {
    const checkbox = document.getElementById('heatmapVictimas');
    
    if (checkbox.checked) {
        if (heatmapVictimas) {
            map.removeLayer(heatmapVictimas);
        }
        
        // Crear datos del mapa de calor usando valores reales de víctimas del nuevo dataset
        const heatData = filteredData.map(item => {
            const victimas = parseFloat(item.victimas) || 1;
            console.log(`Punto: ${item.municipio}, Colonia: ${item.colonia}, Víctimas: ${victimas}, Coords: [${item.latitud}, ${item.longitud}]`);
            return [parseFloat(item.latitud), parseFloat(item.longitud), victimas];
        });
        
        // Calcular el máximo de víctimas para normalización correcta con el nuevo dataset
        const maxVictimas = Math.max(...filteredData.map(item => parseFloat(item.victimas) || 1));
        console.log('✅ Máximo de víctimas encontrado en nuevo dataset:', maxVictimas);
        console.log('📊 Total de puntos en mapa de calor:', heatData.length);

        heatmapVictimas = L.heatLayer(heatData, {
            radius: 23,           // Radio reducido 25% (de 30 a 23)
            blur: 8,              // Blur mantenido
            maxZoom: 12,          // Zoom máximo ajustado
            max: maxVictimas,     // Usar el máximo real del dataset
            gradient: {
                0.0001: 'rgba(0, 0, 255, 0.023)',    // Azul muy transparente (0.034 × 0.67)
                0.1: 'rgba(0, 255, 255, 0.067)',     // Cian (0.1 × 0.67)
                0.3: 'rgba(0, 255, 0, 0.113)',       // Verde (0.168 × 0.67)
                0.5: 'rgba(255, 255, 0, 0.157)',     // Amarillo (0.235 × 0.67)
                0.7: 'rgba(255, 165, 0, 0.202)',     // Naranja (0.302 × 0.67)
                1.0: 'rgba(255, 0, 0, 0.225)'        // Rojo (0.335 × 0.67)
            }
        }).addTo(map);

        console.log('🔥 Mapa de calor activado');
        console.log('📸 Configuración: Radio=23 (reducido 25%), Blur=8, Max=' + maxVíctimas + ' (Transparencia +33%)');
        
    } else {
        if (heatmapVictimas) {
            map.removeLayer(heatmapVictimas);
            heatmapVictimas = null;
            console.log('❌ Mapa de calor de víctimas desactivado');
        }
    }
}

// ===== BORDES MUNICIPALES =====
async function loadMunicipalBorders() {
    try {
        // Cargar datos GeoJSON de municipios de Jalisco
        const response = await fetch('./jalisco_municipios.geojson');
        const jaliscoData = await response.json();
        
        // Filtrar solo los municipios del AMG
        const municipiosAMG = [
            'Guadalajara', 'Zapopan', 'San Pedro Tlaquepaque', 
            'Tlajomulco de Zuñiga', 'Tonala', 'El Salto', 
            'Juanacatlan', 'Ixtlahuacan de los Membrillos', 'Zapotlanejo'
        ]; 
        
        // Crear capa para municipios del AMG
        const amgFeatures = jaliscoData.features.filter(feature => {
            const municipioName = feature.properties.NOMGEO || feature.properties.name || feature.properties.NOM_MUN;
            return municipiosAMG.some(amgMun => 
                municipioName && municipioName.toLowerCase().includes(amgMun.toLowerCase().replace('ú', 'u').replace('á', 'a'))
            );
        });
        
        const amgBorders = {
            type: "FeatureCollection",
            features: amgFeatures
        };
        
        // Crear capa para el estado de Jalisco (todos los municipios)
        const jaliscoBorders = jaliscoData;
        
        // Agregar bordes de municipios del AMG
        const amgLayer = L.geoJSON(amgBorders, {
            style: function(feature) {
                const municipioName = feature.properties.NOMGEO || feature.properties.name || feature.properties.NOM_MUN;
                const municipiosConSombreado = ['Guadalajara', 'Zapopan', 'San Pedro Tlaquepaque','Tlajomulco de Zuñiga', 'Tonala', 'El Salto', 'Juanacatlan', 'Ixtlahuacan de los Membrillos', 'Zapotlanejo'];
                
                // Verificar si este municipio necesita sombreado
                const necesitaSombreado = municipiosConSombreado.some(mun => 
                    municipioName && municipioName.toLowerCase().includes(mun.toLowerCase().replace('ú', 'u').replace('á', 'a'))
                );
                
                return {
                    color: '#66FF66',
                    weight: 2,
                    opacity: 0.2,
                    fillOpacity: necesitaSombreado ? 0.2 : 0.1,
                    fillColor: '#66FF66'
                };
            },
            onEachFeature: function(feature, layer) {
                const municipioName = feature.properties.NOMGEO || feature.properties.name || feature.properties.NOM_MUN;
                layer.bindPopup(`<strong>Municipio AMG:</strong> ${municipioName}`);
            }
        });
        
        // Agregar bordes del estado de Jalisco
        const jaliscoLayer = L.geoJSON(jaliscoBorders, {
            style: {
                color: '#000000',
                weight: 2,
                opacity: 0.1,
                fillOpacity: 0.1,
                dashArray: '3,3'
            },
            onEachFeature: function(feature, layer) {
                const municipioName = feature.properties.NOMGEO || feature.properties.name || feature.properties.NOM_MUN;
		layer.bindPopup(`${municipioName}`);
//****************                layer.bindPopup(`<strong>Municipio:</strong> ${municipioName}`);
            }
        });
        
        // Crear grupo de capas
        municipalBordersLayer = L.layerGroup([jaliscoLayer, amgLayer]).addTo(map);
        
        console.log('✅ Bordes municipales cargados:', amgFeatures.length, 'municipios AMG y', jaliscoBorders.features.length, 'municipios totales');
        
    } catch (error) {
        console.error('Error cargando bordes municipales:', error);
        
        // Fallback a datos simplificados
        const municipalBorders = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"name": "Guadalajara"},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-103.4200, 20.6200], [-103.3800, 20.6200], [-103.3800, 20.6800], 
                            [-103.3400, 20.6800], [-103.3400, 20.7200], [-103.4200, 20.7200], 
                            [-103.4200, 20.6200]
                        ]]
                    }
                },
                {
                    "type": "Feature", 
                    "properties": {"name": "Zapopan"},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-103.4600, 20.6800], [-103.3400, 20.6800], [-103.3400, 20.7600],
                            [-103.4600, 20.7600], [-103.4600, 20.6800]
                        ]]
                    }
                },
                {
                    "type": "Feature",
                    "properties": {"name": "Tlajomulco de Zúñiga"},
                    "geometry": {
                        "type": "Polygon", 
                        "coordinates": [[
                            [-103.5200, 20.4200], [-103.4400, 20.4200], [-103.4400, 20.5200],
                            [-103.5200, 20.5200], [-103.5200, 20.4200]
                        ]]
                    }
                },
                {
                    "type": "Feature",
                    "properties": {"name": "Tonalá"},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-103.2800, 20.6000], [-103.2200, 20.6000], [-103.2200, 20.6600],
                            [-103.2800, 20.6600], [-103.2800, 20.6000]
                        ]]
                    }
                },
                {
                    "type": "Feature",
                    "properties": {"name": "El Salto"},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-103.2400, 20.5000], [-103.1800, 20.5000], [-103.1800, 20.5600],
                            [-103.2400, 20.5600], [-103.2400, 20.5000]
                        ]]
                    }
                },
                {
                    "type": "Feature",
                    "properties": {"name": "San Pedro Tlaquepaque"},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-103.3400, 20.6000], [-103.2800, 20.6000], [-103.2800, 20.6400],
                            [-103.3400, 20.6400], [-103.3400, 20.6000]
                        ]]
                    }
                }
            ]
        };
        
        municipalBordersLayer = L.geoJSON(municipalBorders, {
            style: {
                color: '#66FF66',
                weight: 2,
                opacity: 0.2,
                fillOpacity: 0.2,
                dashArray: '5,5'
            }
        }).addTo(map);
        
        console.log('✅ Bordes municipales cargados (fallback)');
    }
}

function toggleMunicipalBorders() {
    const checkbox = document.getElementById('municipalBorders');
    
    if (checkbox.checked) {
        if (municipalBordersLayer) {
            municipalBordersLayer.addTo(map);
            console.log('✅ Bordes municipales activados');
        }
    } else {
        if (municipalBordersLayer) {
            map.removeLayer(municipalBordersLayer);
            console.log('❌ Bordes municipales desactivados');
        }
    }
}

// ===== FILTROS =====
function populateFilters() {
    populateMunicipioFilter();
    populateDelitoFilter();
    setupTimelineControls();
}

function populateMunicipioFilter() {
    const municipioFilter = document.getElementById('municipioFilter');
    const municipios = [...new Set(allData.map(item => item.municipio))].sort();
    
    municipioFilter.innerHTML = '<option value="">Todos los municipios</option>';
    municipios.forEach(municipio => {
        const option = document.createElement('option');
        option.value = municipio;
        option.textContent = municipio;
        municipioFilter.appendChild(option);
    });
}

function populateDelitoFilter() {
    const delitoFilter = document.getElementById('delitoFilter');
    const delitos = [...new Set(allData.map(item => item.delito))].sort();
    
    delitoFilter.innerHTML = '<option value="">Todos los delitos</option>';
    delitos.forEach(delito => {
        const option = document.createElement('option');
        option.value = delito;
        option.textContent = delito;
        delitoFilter.appendChild(option);
    });
}

function setupTimelineControls() {
    const startYear = document.getElementById('startYear');
    const endYear = document.getElementById('endYear');
    const startYearValue = document.getElementById('startYearValue');
    const endYearValue = document.getElementById('endYearValue');
    
    startYear.addEventListener('input', function() {
        startYearValue.textContent = this.value;
    });
    
    endYear.addEventListener('input', function() {
        endYearValue.textContent = this.value;
    });
}

function setupEventListeners() {
    document.getElementById('applyFilters').addEventListener('click', applyAllFilters);
    document.getElementById('clearFilters').addEventListener('click', clearAllFilters);
    document.getElementById('exportResults').addEventListener('click', exportFilteredData);
    
    // Event listeners para filtros de año (sliders)
    document.getElementById('startYear').addEventListener('input', function() {
        document.getElementById('startYearValue').textContent = this.value;
    });
    
    document.getElementById('endYear').addEventListener('input', function() {
        document.getElementById('endYearValue').textContent = this.value;
    });
    
    // Event listeners para filtros de mes (selectores)
    document.getElementById('startMonth').addEventListener('change', function() {
        console.log('Mes de inicio cambiado a:', this.value);
    });
    
    document.getElementById('endMonth').addEventListener('change', function() {
        console.log('Mes de fin cambiado a:', this.value);
    });
    
    // Event listeners para la simbología por año
    setupYearSymbologyListeners();
    
    // Event listeners para el filtro por tipo de delito
    setupDelitoFilterListeners();
}

// ===== FUNCIONES DE SIMBOLOGÍA POR AÑO =====
function setupYearSymbologyListeners() {
    const yearCheckboxes = document.querySelectorAll('.year-checkbox input[type="checkbox"]');
    const showAllYearsCheckbox = document.getElementById('showAllYears');
    const debouncedUpdate = debounce(() => {
        updateMapMarkers(filteredData.length > 0 ? filteredData : allData);
    }, 150);
    
    yearCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // Si es el checkbox TODOS
            if (this.id === 'showAllYears') {
                // Si se marca TODOS, marcar todos los años
                if (this.checked) {
                    document.getElementById('year-2018').checked = true;
                    document.getElementById('year-2019').checked = true;
                    document.getElementById('year-2020').checked = true;
                    document.getElementById('year-2021').checked = true;
                    document.getElementById('year-2022').checked = true;
                    document.getElementById('year-2023').checked = true;
                    document.getElementById('year-2024').checked = true;
                    document.getElementById('year-2025').checked = true;
                } else {
                    // Si se desmarca TODOS, desmarcar todos los años
                    document.getElementById('year-2018').checked = false;
                    document.getElementById('year-2019').checked = false;
                    document.getElementById('year-2020').checked = false;
                    document.getElementById('year-2021').checked = false;
                    document.getElementById('year-2022').checked = false;
                    document.getElementById('year-2023').checked = false;
                    document.getElementById('year-2024').checked = false;
                    document.getElementById('year-2025').checked = false;
                }
            }
            // Actualizar marcadores con debounce para optimizar rendimiento
            debouncedUpdate();
        });
    });
}

// ===== FUNCIONES PARA FILTRO POR TIPO DE DELITO =====
function setupDelitoFilterListeners() {
    const delitoCheckboxes = document.querySelectorAll('.delito-checkbox input[type="checkbox"]');
    const debouncedUpdate = debounce(() => {
        updateMapMarkers(filteredData.length > 0 ? filteredData : allData);
    }, 150);
    
    delitoCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // Actualizar marcadores con debounce para optimizar rendimiento
            debouncedUpdate();
        });
    });
}

function getSelectedDelitos() {
    const delitoCheckboxes = document.querySelectorAll('.delito-checkbox input[type="checkbox"]:checked');
    return Array.from(delitoCheckboxes).map(checkbox => checkbox.value.toLowerCase());
}

function isDelitoSelected(delito, selectedDelitos) {
    if (selectedDelitos.length === 0) {
        return true; // Si no hay ninguno seleccionado, mostrar todos
    }
    
    const delitoLower = (delito || '').toLowerCase().trim();
    
    // Verificar si el delito coincide con alguno de los seleccionados
    return selectedDelitos.some(selected => delitoLower.includes(selected));
}

function getSelectedYears() {
    const yearCheckboxes = document.querySelectorAll('.year-checkbox input[type="checkbox"]:checked');
    return Array.from(yearCheckboxes).map(checkbox => checkbox.value);
}

function getShow2025p() {
    // Esta función ya no es necesaria con el nuevo sistema de TODOS
    return false;
}

function applyAllFilters() {
    const municipioFilter = document.getElementById('municipioFilter').value;
    const delitoFilter = document.getElementById('delitoFilter').value;
    const startYear = parseInt(document.getElementById('startYear').value);
    const endYear = parseInt(document.getElementById('endYear').value);
    const startMonth = parseInt(document.getElementById('startMonth').value);
    const endMonth = parseInt(document.getElementById('endMonth').value);
    
    // Mapeo de nombres de meses en español a números (0-11)
    const monthMap = {
        'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3,
        'MAYO': 4, 'JUNIO': 5, 'JULIO': 6, 'AGOSTO': 7,
        'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
    };
    
    filteredData = allData.filter(item => {
        const municipioMatch = !municipioFilter || item.municipio === municipioFilter;
        const delitoMatch = !delitoFilter || item.delito === delitoFilter;
        
        // Filtrado por año
        const yearMatch = item.año >= startYear && item.año <= endYear;
        
        // Filtrado por mes
        let monthMatch = true;
        if (item.mes && monthMap.hasOwnProperty(item.mes.toUpperCase())) {
            const itemMonth = monthMap[item.mes.toUpperCase()];
            
            // Si el año de inicio y fin son diferentes, aplicar lógica especial
            if (startYear !== endYear) {
                if (item.año === startYear) {
                    monthMatch = itemMonth >= startMonth;
                } else if (item.año === endYear) {
                    monthMatch = itemMonth <= endMonth;
                } else if (item.año > startYear && item.año < endYear) {
                    monthMatch = true; // Años intermedios incluyen todos los meses
                }
            } else {
                // Mismo año: filtrar por rango de meses
                monthMatch = itemMonth >= startMonth && itemMonth <= endMonth;
            }
        }
        
        return municipioMatch && delitoMatch && yearMatch && monthMatch;
    });
    
    updateDashboard(filteredData);
    updateCharts(filteredData);
    updateMapMarkers(filteredData);
    
    // Actualizar mapas de calor si están activos
    if (document.getElementById('heatmapVictimas').checked) {
        toggleHeatmapVictimas();
        document.getElementById('heatmapVictimas').checked = true;
        toggleHeatmapVictimas();
    }
    
    console.log('Filtros aplicados. Registros filtrados:', filteredData.length);
}

function clearAllFilters() {
    document.getElementById('municipioFilter').value = '';
    document.getElementById('delitoFilter').value = '';
    document.getElementById('startYear').value = '2018';
    document.getElementById('endYear').value = '2025';
    document.getElementById('startMonth').value = '0';
    document.getElementById('endMonth').value = '11';
    document.getElementById('startYearValue').textContent = '2018';
    document.getElementById('endYearValue').textContent = '2025';
    
    filteredData = [...allData];
    updateDashboard(filteredData);
    updateCharts(filteredData);
    updateMapMarkers(filteredData);
    
    console.log('Filtros limpiados. Mostrando todos los datos:', filteredData.length);
}

// ===== DASHBOARD =====
function updateDashboard(data) {
    const totalRegistros = data.length;
    const totalVictimas = data.reduce((sum, item) => sum + item.victimas, 0);
    
    document.getElementById('totalRegistros').textContent = totalRegistros;
    document.getElementById('totalVictimas').textContent = totalVictimas;
}

// ===== GRÁFICAS =====
function updateCharts(data) {
    updateMunicipioChart(data);
    updateAnualChart(data);
    updateFosasChart(data);
    updateFosasAnualChart(data);
    initializePivotTable(data);  //********************************************
}

function updateMunicipioChart(data) {
    const municipioData = {};
    data.forEach(item => {
        municipioData[item.municipio] = (municipioData[item.municipio] || 0) + item.victimas;
    });
    
    const sortedData = Object.entries(municipioData)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
    
    const ctx = document.getElementById('municipioChart').getContext('2d');
    
    if (municipioChart) {
        municipioChart.destroy();
    }
    
    municipioChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedData.map(([municipio]) => municipio),
            datasets: createStackedDatasets(sortedData, data)
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 8,
                        font: {
                            size: 11
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true
                }
            }
        }
    });
}

function createStackedDatasets(sortedData, data) {
    const municipios = sortedData.map(([municipio]) => municipio);
    const years = Object.keys(YEAR_COLORS).filter(year => year !== '2025p').sort();
    
    return years.map(year => {
        const yearInt = parseInt(year);
        const chartData = municipios.map(municipio => {
            const municipioData = data.filter(item => 
                item.municipio === municipio && item.año === yearInt
            );
            return municipioData.reduce((sum, item) => sum + item.victimas, 0);
        });
        
        return {
            label: year,
            data: chartData,
            backgroundColor: YEAR_COLORS[year],
            borderColor: YEAR_COLORS[year],
            borderWidth: 1
        };
    });
}

function updateAnualChart(data) {
    // Definir los 9 municipios del AMG con variaciones posibles
    const municipiosAMG = [
        'Guadalajara',
        'Zapopan', 
        'San Pedro Tlaquepaque',
        'Tlajomulco de Zúñiga',
        'Tonala',
        'El Salto',
        'Juanacatlán',
        'Ixtlahuacan de los Membrillos',
        'Zapotlanejo'
    ];
    
    // Función para normalizar nombres de municipios (sin acentos, minúscula, sin espacios extras)
    const normalizeMunicipio = (nombre) => {
        return nombre
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    };
    
    // Crear mapa de municipios normalizados
    const municipiosNormalizados = {};
    municipiosAMG.forEach(m => {
        municipiosNormalizados[normalizeMunicipio(m)] = m;
    });
    
    // Agrupar datos por año y municipio
    const anualData = {};
    data.forEach(item => {
        if (!anualData[item.año]) {
            anualData[item.año] = {};
        }
        
        // Normalizar el nombre del municipio del dato
        const municipioNormalizado = normalizeMunicipio(item.municipio);
        const municipioKey = municipiosNormalizados[municipioNormalizado] || 'Interior del estado';
        
        anualData[item.año][municipioKey] = (anualData[item.año][municipioKey] || 0) + item.victimas;
    });
    
    // Obtener años ordenados
    const años = Object.keys(anualData).sort();
    
    // Crear lista de municipios: 9 del AMG + Interior del estado
    const municipiosParaGrafico = [...municipiosAMG, 'Interior del estado'];
    
    // Colores para los 9 municipios del AMG
    const coloresAMG = [
        '#2C3E50', '#27AE60', '#3498DB', '#F1C40F', '#E67E22', 
        '#9B59B6', '#95A5A6', '#E74C3C', '#34495E'
    ];
    
    // Crear datasets para cada municipio (barras APILADAS)
    const datasets = municipiosParaGrafico.map((municipio, index) => {
        const color = municipio === 'Interior del estado' ? '#20C997' : coloresAMG[index];
        
        return {
            label: municipio,
            data: años.map(año => {
                return anualData[año] && anualData[año][municipio] ? anualData[año][municipio] : 0;
            }),
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1
        };
    });
    
    const ctx = document.getElementById('anualChart').getContext('2d');
    
    if (anualChart) {
        anualChart.destroy();
    }
    
    anualChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: años,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 8,
                        font: {
                            size: 11
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true
                }
            }
        }
    });
}

// ===== NUEVOS GRÁFICOS DE FOSAS CLANDESTINAS =====

function updateFosasChart(data) {
    // Gráfico: Casos por municipio con delitos apilados
    
    // Definir los 9 municipios del AMG
    const municipiosAMG = [
        'Guadalajara',
        'Zapopan', 
        'San Pedro Tlaquepaque',
        'Tlajomulco de Zúñiga',
        'Tonala',
        'El Salto',
        'Juanacatlán',
        'Ixtlahuacan de los Membrillos',
        'Zapotlanejo'
    ];
    
    // Función para normalizar nombres de municipios
    const normalizeMunicipio = (nombre) => {
        return nombre
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    };
    
    // Función para normalizar nombres de delitos (sin acentos, minúscula)
    const normalizeDelito = (nombre) => {
        return nombre
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    };
    
    // Crear mapa de delitos normalizados
    const delitosCanonicos = {
        "violencia familiar": "Violencia familiar",
        "abuso sexual infantil": "Abuso sexual infantil",
        "violacion": "Violación",
        "feminicidio": "Feminicidio"
    };
    
    const delitoNormalizadoMap = {};
    Object.keys(delitosCanonicos).forEach(d => {
        delitoNormalizadoMap[normalizeDelito(d)] = d;
    });
    
    // Crear mapa de municipios normalizados
    const municipiosNormalizados = {};
    municipiosAMG.forEach(m => {
        municipiosNormalizados[normalizeMunicipio(m)] = m;
    });
    
    // Agrupar datos por municipio y tipo de delito
    const municipioData = {};
    data.forEach(item => {
        // Normalizar el nombre del municipio
        const municipioNormalizado = normalizeMunicipio(item.municipio);
        const municipioKey = municipiosNormalizados[municipioNormalizado] || 'Interior del estado';
        
        if (!municipioData[municipioKey]) {
            municipioData[municipioKey] = {};
        }
        
        const delitoNormalizado = normalizeDelito(item.delito || 'Desconocido');
        const delitoKey = delitoNormalizadoMap[delitoNormalizado] || 'desconocido';
        municipioData[municipioKey][delitoKey] = (municipioData[municipioKey][delitoKey] || 0) + 1;
    });
    
    // Obtener tipos de delito ordenados
    const delitos = ['violencia familiar', 'abuso sexual infantil', 'violacion', 'feminicidio']
        .filter(d => {
            return Object.values(municipioData).some(m => m[d]);
        });
    
    // Crear lista de municipios: 9 del AMG + Interior del estado
    const municipiosParaGrafico = [...municipiosAMG, 'Interior del estado'];
    
    // Colores para los tipos de delito
    const coloresDelitos = {
        'violencia familiar': '#FF6B6B',
        'abuso sexual infantil': '#4ECDC4',
        'violacion': '#45B7D1',
        'feminicidio': '#FFA07A'
    };
    
    // Crear datasets para cada tipo de delito (cada delito será un segmento apilado)
    const datasets = delitos.map(delito => {
        return {
            label: delitosCanonicos[delito],
            data: municipiosParaGrafico.map(municipio => {
                return municipioData[municipio] && municipioData[municipio][delito] ? municipioData[municipio][delito] : 0;
            }),
            backgroundColor: coloresDelitos[delito],
            borderColor: coloresDelitos[delito],
            borderWidth: 1
        };
    });
    
    const ctx = document.getElementById('fosasChart').getContext('2d');
    
    if (fosasChart) {
        fosasChart.destroy();
    }
    
    fosasChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: municipiosParaGrafico,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 8,
                        font: {
                            size: 11
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true
                }
            }
        }
    });
}

function updateFosasAnualChart(data) {
    // Función para normalizar nombres de delitos (sin acentos, minúscula)
    const normalizeDelito = (nombre) => {
        return nombre
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    };
    
    // Crear mapa de delitos normalizados
    const delitosCanonicos = {
        'violencia familiar': 'Violencia familiar',
        'abuso sexual infantil': 'Abuso sexual infantil',
        'violacion': 'Violación',
        'feminicidio': 'Feminicidio'
    };
    
    const delitoNormalizadoMap = {};
    Object.keys(delitosCanonicos).forEach(d => {
        delitoNormalizadoMap[normalizeDelito(d)] = d;
    });
    
    // Agrupar datos por año y tipo de delito
    const delitoAnualData = {};
    data.forEach(item => {
        if (!delitoAnualData[item.año]) {
            delitoAnualData[item.año] = {};
        }
        
        // Normalizar el nombre del delito
        const delitoNormalizado = normalizeDelito(item.delito || 'Desconocido');
        const delitoKey = delitoNormalizadoMap[delitoNormalizado] || 'desconocido';
        
        delitoAnualData[item.año][delitoKey] = (delitoAnualData[item.año][delitoKey] || 0) + 1;
    });
    
    // Obtener años ordenados
    const años = Object.keys(delitoAnualData).sort();
    
    // Obtener tipos de delito ordenados
    const delitos = ['violencia familiar', 'abuso sexual infantil', 'violacion', 'feminicidio']
        .filter(d => {
            return años.some(año => delitoAnualData[año][d]);
        });
    
    // Colores para los tipos de delito
    const coloresDelitos = {
        'violencia familiar': '#FF6B6B',
        'abuso sexual infantil': '#4ECDC4',
        'violacion': '#45B7D1',
        'feminicidio': '#FFA07A'
    };
    
    // Crear datasets para cada tipo de delito
    const datasets = delitos.map(delito => {
        return {
            label: delitosCanonicos[delito],
            data: años.map(año => {
                return delitoAnualData[año] && delitoAnualData[año][delito] ? delitoAnualData[año][delito] : 0;
            }),
            backgroundColor: coloresDelitos[delito],
            borderColor: coloresDelitos[delito],
            borderWidth: 1
        };
    });
    
    const ctx = document.getElementById('fosasAnualChart').getContext('2d');
    
    if (fosasAnualChart) {
        fosasAnualChart.destroy();
    }
    
    fosasAnualChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: años,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 8,
                        font: {
                            size: 11
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true
                },
                y: {
                    stacked: true,
                    beginAtZero: true
                }
            }
        }
    });
}

// ===== EXPORTACIÓN =====
function exportFilteredData() {
    try {
        const dataToExport = filteredData.length > 0 ? filteredData : allData;
        
        if (dataToExport.length === 0) {
            alert('No hay datos para exportar');
            return;
        }
        
        // Encabezados exactos según especificación
        const headers = ['Referencia', 'Municipio', 'Colonia', 'Victimas', 'Año', 'Delito', 'Latitud', 'Longitud', 'Link'];
        
        // Función para escapar y formatear campos CSV correctamente
        function formatCSVField(value) {
            if (value === null || value === undefined) {
                return '""';
            }
            
            // Convertir a string y limpiar caracteres problemáticos
            let cleanValue = String(value)
                .replace(/"/g, '""')  // Escapar comillas dobles
                .trim();
            
            // Siempre envolver en comillas para consistencia
            return `"${cleanValue}"`;
        }
        
        // Crear contenido CSV con formato correcto
        const csvRows = [];
        
        // Agregar encabezados
        csvRows.push(headers.map(header => formatCSVField(header)).join(','));
        
        // Agregar datos
        dataToExport.forEach(item => {
            const row = [
                item.referencia || '',
                item.municipio || '',
                item.colonia || '', // Corregido: ahora incluye el campo colonia del dataset
                item.victimas || '',
                item.año || '',
                item.delito || '',
                item.latitud || '',
                item.longitud || '',
                item.link || ''
            ];
            
            csvRows.push(row.map(field => formatCSVField(field)).join(','));
        });
        
        // Unir todas las filas con saltos de línea
        const csvContent = csvRows.join('\n');
        
        // Agregar BOM para UTF-8
        const BOM = '\uFEFF';
        const csvWithBOM = BOM + csvContent;
        
        // Crear blob con codificación UTF-8 explícita
        const blob = new Blob([csvWithBOM], { 
            type: 'text/csv;charset=utf-8;' 
        });
        
        // Crear enlace de descarga
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `datos_victimas_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Limpiar URL
        URL.revokeObjectURL(url);
        
        console.log('✅ Datos exportados correctamente:', dataToExport.length, 'registros');
        console.log('📁 Formato: CSV UTF-8 con estructura de filas y columnas');
        
    } catch (error) {
        console.error('❌ Error al exportar datos:', error);
        alert('Error al exportar los datos. Por favor, inténtelo de nuevo.');
    }
}

const EXCEL_DATA = [];
// ===== MÓDULO DE ACTUALIZACIÓN EN TIEMPO REAL =====
class RealTimeDataManager {
    constructor() {
        this.googleSheetsUrl = 'https://docs.google.com/spreadsheets/d/1X_d7ncZSUiDMkeZmD1MyE5jIi58qGacFrTRE4-d62as/export?format=csv&gid=0';
        this.updateInterval = 30000; // 30 segundos
        this.lastDataHash = null;
        this.isUpdating = false;
        this.intervalId = null;
        this.statusElement = null;
        this.createStatusIndicator();
        this.startAutoUpdate();
    }

    createStatusIndicator() {
        // Crear indicador de estado en el header
        const headerContent = document.querySelector('.header-content');
        if (headerContent) {
            const statusDiv = document.createElement('div');
            statusDiv.className = 'real-time-status';
            statusDiv.innerHTML = `
                <div class="status-indicator">
                    <span id="status-icon">🟢</span>
                    <span id="status-text">Monitoreo activo</span>
                    <button id="manual-update" title="Actualizar manualmente">🔄</button>
                </div>
            `;
            headerContent.appendChild(statusDiv);
            this.statusElement = statusDiv;

            // Event listener para actualización manual
            document.getElementById('manual-update').addEventListener('click', () => {
                this.updateData(true);
            });
        }
    }

    updateStatus(icon, text) {
        const statusIcon = document.getElementById('status-icon');
        const statusText = document.getElementById('status-text');
        if (statusIcon) statusIcon.textContent = icon;
        if (statusText) statusText.textContent = text;
    }

    async fetchDataFromGoogleSheets() {
        try {
            this.updateStatus('🔄', 'Verificando cambios...');
            
            const response = await fetch(this.googleSheetsUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const csvText = await response.text();
            return this.parseCSVData(csvText);
        } catch (error) {
            console.error('Error fetching data from Google Sheets:', error);
            this.updateStatus('❌', 'Error de conexión');
            throw error;
        }
    }

    parseCSVData(csvText) {
        const lines = csvText.split('\n');
        const data = [];
        
        // Leer header para detectar nombres de columnas
        if (lines.length < 2) return data;
        
        const headerLine = lines[0].trim();
        const headers = this.parseCSVRow(headerLine).map(h => h.trim().toLowerCase());
        
        console.log('📋 Headers detectados:', headers);
        
        // Detectar índices de columnas de coordenadas (flexible)
        let longitudIndex = -1;
        let latitudIndex = -1;
        
        // Buscar columna de longitud (x, longitud, lon, lng)
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            if (header === 'x' || header === 'longitud' || header === 'lon' || header === 'lng' || header === 'longitude') {
                longitudIndex = i;
                console.log(`✅ Columna de Longitud encontrada en índice ${i}: "${header}"`);
                break;
            }
        }
        
        // Buscar columna de latitud (y, latitud, lat)
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            if (header === 'y' || header === 'latitud' || header === 'lat' || header === 'latitude') {
                latitudIndex = i;
                console.log(`✅ Columna de Latitud encontrada en índice ${i}: "${header}"`);
                break;
            }
        }
        
        if (longitudIndex === -1 || latitudIndex === -1) {
            console.error('❌ ERROR: No se encontraron columnas de coordenadas');
            console.error('Headers disponibles:', headers);
            return data;
        }
        
        // Procesar filas de datos
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const row = this.parseCSVRow(line);
            if (row.length >= 6) {
                try {
                    // Extraer fecha y procesar año
                    const fechaValue = row[0].trim();
                    let añoProcessed = 2025;
                    let mesProcessed = '';
                    
                    if (fechaValue) {
                        const añoMatch = fechaValue.match(/(\d{4})/);
                        if (añoMatch) {
                            añoProcessed = parseInt(añoMatch[1]);
                        }
                        
                        const mesMatch = fechaValue.match(/\/(\d{1,2})\//);
                        if (mesMatch) {
                            const mesNum = parseInt(mesMatch[1]);
                            const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
                                          'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
                            mesProcessed = meses[mesNum - 1] || '';
                        }
                    }

                    // Procesar coordenadas usando índices detectados
                    const longitudStr = row[longitudIndex] ? row[longitudIndex].trim() : 'NA';
                    const latitudStr = row[latitudIndex] ? row[latitudIndex].trim() : 'NA';
                    
                    let longitudProcessed = 0;
                    let latitudProcessed = 0;
                    
                    if (longitudStr && longitudStr !== 'NA') {
                        longitudProcessed = parseFloat(longitudStr.replace(',', '.'));
                    }
                    
                    if (latitudStr && latitudStr !== 'NA') {
                        latitudProcessed = parseFloat(latitudStr.replace(',', '.'));
                    }
                    
                    // Validar que las coordenadas sean números válidos
                    if (isNaN(longitudProcessed)) longitudProcessed = 0;
                    if (isNaN(latitudProcessed)) latitudProcessed = 0;

                    const record = {
                        referencia: row[0].trim(),
                        municipio: row[5].trim(),
                        colonia: row[4].trim(),
                        victimas: 1,
                        año: añoProcessed,
                        mes: mesProcessed,
                        year: añoProcessed,
                        month: mesProcessed,
                        latitud: latitudProcessed,
                        longitud: longitudProcessed,
                        link: '',
                        delito: row[1].trim() || "Violencia de Género",
                        zona_geografica: row[9] ? row[9].trim() : 'Sin zona',
                        hora: row[7] ? row[7].trim() : 'Sin horario',
                        bien_afectado: row[8] ? row[8].trim() : '',
                        hasCoordinates: (longitudProcessed !== 0 && latitudProcessed !== 0)
                    };
                    
                    // Agregar TODOS los registros (incluyendo los que tienen NA)
                    data.push(record);
                    
                    if (record.hasCoordinates) {
                        console.log(`✅ Registro con coordenadas: ${record.municipio} [${record.longitud}, ${record.latitud}]`);
                    } else {
                        console.log(`⚠️ Registro sin coordenadas (NA): ${record.municipio}`);
                    }
                    
                } catch (error) {
                    console.warn('Error processing row:', row, error);
                }
            }
        }
        
        console.log(`📊 Total de registros procesados con coordenadas: ${data.length}`);
        return data;
    }

    parseCSVRow(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    calculateDataHash(data) {
        const dataString = JSON.stringify(data.map(item => ({
            ref: item.referencia,
            mun: item.municipio,
            vic: item.victimas,
            año: item.año,
            mes: item.mes
        })));
        
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }

    async updateData(isManual = false) {
        if (this.isUpdating && !isManual) return;
        
        this.isUpdating = true;
        
        try {
            const newData = await this.fetchDataFromGoogleSheets();
            const newHash = this.calculateDataHash(newData);
            
            if (this.lastDataHash === null || this.lastDataHash !== newHash) {
                // Datos han cambiado, actualizar
                allData = newData;
                filteredData = [...allData];
                
                // Actualizar dashboard, mapa, gráficos y tabla pivot
                updateDashboard(filteredData);
                updateMapMarkers(filteredData);
                updateCharts(allData);
                updatePivotTable(allData);
                populateFilters();
                
                this.lastDataHash = newHash;
                
                const now = new Date().toLocaleTimeString();
                this.updateStatus('✅', `Actualizado: ${now}`);
                
                if (isManual) {
                    this.showNotification('Datos actualizados manualmente');
                } else {
                    this.showNotification('Nuevos datos detectados y cargados');
                }
                
                console.log('Datos actualizados:', newData.length, 'registros');
            } else {
                // No hay cambios
                const now = new Date().toLocaleTimeString();
                this.updateStatus('🟢', 'Monitoreo activo');
                
                if (isManual) {
                    this.showNotification('No hay cambios en los datos');
                }
            }
        } catch (error) {
            console.error('Error updating data:', error);
            this.updateStatus('❌', 'Error de conexión');
        } finally {
            this.isUpdating = false;
        }
    }

    showNotification(message) {
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.className = 'real-time-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    startAutoUpdate() {
        // Actualización inicial
        this.updateData();
        
        // Configurar actualizaciones periódicas
        this.intervalId = setInterval(() => {
            this.updateData();
        }, this.updateInterval);
        
        console.log('Sistema de tiempo real iniciado - Actualizaciones cada 30 segundos');
    }

    stopAutoUpdate() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.updateStatus('⏸️', 'Monitoreo pausado');
    }
}

// Inicializar sistema de tiempo real después del login
let realTimeManager = null;

// NOTA: La función initializeApp() está definida en la línea 89
// Esta versión duplicada ha sido eliminada para evitar conflictos



// ===== FUNCIÓN PARA CAMBIAR CAPA BASE =====
function changeBaseLayer() {
    const selectedBase = document.querySelector('input[name="baseLayer"]:checked').value;
    
    // Remover todas las capas base actuales
    map.eachLayer(function(layer) {
        if (layer._url && (layer._url.includes('openstreetmap') || 
                          layer._url.includes('arcgisonline') || 
                          layer._url.includes('World_Imagery') || 
                          layer._url.includes('World_Topo_Map'))) {
            map.removeLayer(layer);
        }
    });
    
    // Agregar la nueva capa base seleccionada
    if (window.baseLayers && window.baseLayers[selectedBase]) {
        window.baseLayers[selectedBase].addTo(map);
    }
}




// ===== TABLA DINÁMICA (PIVOT TABLE) =====

class PivotTableManager {
    constructor() {
        this.data = [];
        this.filteredData = [];
        this.selectedDelitos = new Set(['abuso sexual infantil', 'feminicidio', 'violacion', 'violencia familiar']);
        this.expandedRows = new Set();
        this.expandedYears = new Set();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Event listeners para los checkboxes de delito
        const delitoCheckboxes = document.querySelectorAll('.pivot-delito-filter input[type="checkbox"]');
        delitoCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSelectedDelitos();
                this.renderTable();
            });
        });
    }

    updateSelectedDelitos() {
        this.selectedDelitos.clear();
        const checkboxes = document.querySelectorAll('.pivot-delito-filter input[type="checkbox"]:checked');
        checkboxes.forEach(cb => {
            this.selectedDelitos.add(cb.value.toLowerCase());
        });
    }

    updateData(data) {
        this.data = data;
        this.filterData();
        this.renderTable();
    }

    filterData() {
        // Filtrar por delitos seleccionados
        this.filteredData = this.data.filter(record => {
            const delito = (record.delito || '').toLowerCase();
            return Array.from(this.selectedDelitos).some(selectedDelito => 
                delito.includes(selectedDelito)
            );
        });
    }

    renderTable() {
        const container = document.getElementById('pivot-table');
        if (!container) return;

        if (this.filteredData.length === 0) {
            container.innerHTML = '<div class="pivot-loading">No hay datos para mostrar</div>';
            return;
        }

        // Agrupar datos
        const groupedData = this.groupData();
        
        // Generar HTML de la tabla
        const tableHTML = this.generateTableHTML(groupedData);
        container.innerHTML = tableHTML;

        // Agregar event listeners para expansión/colapso
        this.attachExpandListeners();
    }

    groupData() {
        const groups = {};

        this.filteredData.forEach(record => {
            const zona = record.zona_geografica || 'Sin zona';
            const municipio = record.municipio || 'Sin municipio';
            const delito = record.delito || 'Sin delito';
            const colonia = record.colonia || 'NO DISPONIBLE';
            const year = record.year || 'Sin año';
            const month = record.month || 'Sin mes';

            // Inicializar estructura jerárquica: Zona → Municipio → Delito → Colonia → Año → Mes
            if (!groups[zona]) {
                groups[zona] = { count: 0, municipios: {} };
            }
            if (!groups[zona].municipios[municipio]) {
                groups[zona].municipios[municipio] = { count: 0, delitos: {} };
            }
            if (!groups[zona].municipios[municipio].delitos[delito]) {
                groups[zona].municipios[municipio].delitos[delito] = { count: 0, colonias: {} };
            }
            if (!groups[zona].municipios[municipio].delitos[delito].colonias[colonia]) {
                groups[zona].municipios[municipio].delitos[delito].colonias[colonia] = { count: 0, years: {} };
            }

            const coloniaGroup = groups[zona].municipios[municipio].delitos[delito].colonias[colonia];
            
            if (!coloniaGroup.years[year]) {
                coloniaGroup.years[year] = { count: 0, months: {} };
            }
            if (!coloniaGroup.years[year].months[month]) {
                coloniaGroup.years[year].months[month] = 0;
            }

            // Incrementar contadores
            coloniaGroup.years[year].months[month]++;
            coloniaGroup.years[year].count++;
            coloniaGroup.count++;
            groups[zona].municipios[municipio].delitos[delito].count++;
            groups[zona].municipios[municipio].count++;
            groups[zona].count++;
        });

        return groups;
    }

    generateTableHTML(groupedData) {
        const years = this.getYears();
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        let html = '<table><thead><tr>';
        html += '<th></th>';
        
        // Encabezados de años (con posibilidad de expandir a meses)
        years.forEach(year => {
            const isExpanded = this.expandedYears.has(year);
            const expandIcon = isExpanded ? '⊖' : '⊕';
            
            if (isExpanded) {
                // Mostrar 12 columnas de meses
                months.forEach(month => {
                    html += `<th class="month-header" data-year="${year}" data-month="${month}">
                                ${month.substring(0, 3)} ${year}
                             </th>`;
                });
            } else {
                // Mostrar solo columna de año
                html += `<th class="year-header" data-year="${year}">
                            <span class="expand-year-btn">${expandIcon}</span> ${year}
                         </th>`;
            }
        });
        html += '<th class="total-column">TOTAL</th>';
        html += '</tr></thead><tbody>';

        // Calcular totales de JALISCO (suma de todas las zonas)
        const jaliscoData = this.calculateJaliscoTotals(groupedData);
        html += this.generateJaliscoRow(jaliscoData, years, months);

        // Ordenar zonas por conteo (mayor a menor)
        const sortedZonas = Object.entries(groupedData)
            .sort((a, b) => b[1].count - a[1].count);

        sortedZonas.forEach(([zona, zonaData]) => {
            html += this.generateZonaRow(zona, zonaData, years, months);
            html += this.generateMunicipioRows(zona, zonaData, years, months);
        });

        html += '</tbody></table>';
        return html;
    }

    calculateJaliscoTotals(groupedData) {
        const jaliscoData = { count: 0, years: {} };
        
        // Sumar todos los datos de todas las zonas
        Object.values(groupedData).forEach(zonaData => {
            jaliscoData.count += zonaData.count;
            
            // Recorrer municipios → delitos → colonias para sumar por año y mes
            Object.values(zonaData.municipios).forEach(municipioData => {
                Object.values(municipioData.delitos).forEach(delitoData => {
                    Object.values(delitoData.colonias).forEach(coloniaData => {
                        Object.entries(coloniaData.years).forEach(([year, yearData]) => {
                            if (!jaliscoData.years[year]) {
                                jaliscoData.years[year] = { count: 0, months: {} };
                            }
                            jaliscoData.years[year].count += yearData.count;
                            
                            Object.entries(yearData.months).forEach(([month, monthCount]) => {
                                if (!jaliscoData.years[year].months[month]) {
                                    jaliscoData.years[year].months[month] = 0;
                                }
                                jaliscoData.years[year].months[month] += monthCount;
                            });
                        });
                    });
                });
            });
        });
        
        return jaliscoData;
    }

    generateJaliscoRow(jaliscoData, years, months) {
        let html = `<tr class="level-0 jalisco-row">`;
        html += `<td><strong>JALISCO</strong></td>`;
        
        years.forEach(year => {
            const isExpanded = this.expandedYears.has(year);
            
            if (isExpanded) {
                // Mostrar conteos por mes
                months.forEach(month => {
                    const count = jaliscoData.years[year] && jaliscoData.years[year].months[month] 
                        ? jaliscoData.years[year].months[month] 
                        : 0;
                    html += `<td><strong>${count}</strong></td>`;
                });
            } else {
                // Mostrar conteo total del año
                const count = jaliscoData.years[year] ? jaliscoData.years[year].count : 0;
                html += `<td><strong>${count}</strong></td>`;
            }
        });
        
        html += `<td class="total-cell"><strong>${jaliscoData.count}</strong></td>`;
        html += '</tr>';
        return html;
    }

    generateZonaRow(zona, zonaData, years, months) {
        const rowId = `zona-${this.sanitizeId(zona)}`;
        let html = `<tr class="level-1" data-row-id="${rowId}">`;
        html += `<td><span class="expand-btn collapsed" data-target="${rowId}"></span>${zona}</td>`;
        
        years.forEach(year => {
            const isExpanded = this.expandedYears.has(year);
            
            if (isExpanded) {
                // Mostrar conteos por mes
                months.forEach(month => {
                    const count = this.countByYearAndMonth(zonaData, year, month);
                    html += `<td>${count}</td>`;
                });
            } else {
                // Mostrar conteo total del año
                const count = this.countByYear(zonaData, year);
                html += `<td>${count}</td>`;
            }
        });
        
        html += `<td class="total-cell">${zonaData.count}</td>`;
        html += '</tr>';
        return html;
    }

    generateMunicipioRows(zona, zonaData, years, months) {
        let html = '';
        const zonaId = `zona-${this.sanitizeId(zona)}`;
        
        // Ordenar municipios por conteo
        const sortedMunicipios = Object.entries(zonaData.municipios)
            .sort((a, b) => b[1].count - a[1].count);

        sortedMunicipios.forEach(([municipio, municipioData]) => {
            const rowId = `mun-${this.sanitizeId(zona)}-${this.sanitizeId(municipio)}`;
            html += `<tr class="level-2 hidden" data-parent="${zonaId}" data-row-id="${rowId}">`;
            html += `<td><span class="expand-btn collapsed" data-target="${rowId}"></span>${municipio}</td>`;
            
            years.forEach(year => {
                const isExpanded = this.expandedYears.has(year);
                
                if (isExpanded) {
                    // Mostrar conteos por mes
                    months.forEach(month => {
                        const count = this.countByYearAndMonth(municipioData, year, month);
                        html += `<td>${count}</td>`;
                    });
                } else {
                    // Mostrar conteo total del año
                    const count = this.countByYear(municipioData, year);
                    html += `<td>${count}</td>`;
                }
            });
            
            html += `<td class="total-cell">${municipioData.count}</td>`;
            html += '</tr>';
            
            html += this.generateDelitoRows(zona, municipio, municipioData, years, months);
        });

        return html;
    }

    generateDelitoRows(zona, municipio, municipioData, years, months) {
        let html = '';
        const munId = `mun-${this.sanitizeId(zona)}-${this.sanitizeId(municipio)}`;
        
        // Ordenar delitos por conteo
        const sortedDelitos = Object.entries(municipioData.delitos)
            .sort((a, b) => b[1].count - a[1].count);

        sortedDelitos.forEach(([delito, delitoData]) => {
            const rowId = `del-${this.sanitizeId(zona)}-${this.sanitizeId(municipio)}-${this.sanitizeId(delito)}`;
            html += `<tr class="level-3 hidden" data-parent="${munId}" data-row-id="${rowId}">`;
            html += `<td><span class="expand-btn collapsed" data-target="${rowId}"></span>${delito}</td>`;
            
            years.forEach(year => {
                const isExpanded = this.expandedYears.has(year);
                
                if (isExpanded) {
                    // Mostrar conteos por mes
                    months.forEach(month => {
                        const count = this.countByYearAndMonth(delitoData, year, month);
                        html += `<td>${count}</td>`;
                    });
                } else {
                    // Mostrar conteo total del año
                    const count = this.countByYear(delitoData, year);
                    html += `<td>${count}</td>`;
                }
            });
            
            html += `<td class="total-cell">${delitoData.count}</td>`;
            html += '</tr>';
            
            html += this.generateColoniaRows(zona, municipio, delito, delitoData, years, months);
        });

        return html;
    }

    generateColoniaRows(zona, municipio, delito, delitoData, years, months) {
        let html = '';
        const delId = `del-${this.sanitizeId(zona)}-${this.sanitizeId(municipio)}-${this.sanitizeId(delito)}`;
        
        // Ordenar colonias por conteo
        const sortedColonias = Object.entries(delitoData.colonias)
            .sort((a, b) => b[1].count - a[1].count);

        sortedColonias.forEach(([colonia, coloniaData]) => {
            html += `<tr class="level-4 hidden" data-parent="${delId}">`;
            html += `<td>${colonia}</td>`;
            
            years.forEach(year => {
                const isExpanded = this.expandedYears.has(year);
                
                if (isExpanded) {
                    // Mostrar conteos por mes
                    months.forEach(month => {
                        const yearData = coloniaData.years[year];
                        const count = yearData && yearData.months[month] ? yearData.months[month] : 0;
                        html += `<td>${count}</td>`;
                    });
                } else {
                    // Mostrar conteo total del año
                    const count = coloniaData.years[year] ? coloniaData.years[year].count : 0;
                    html += `<td>${count}</td>`;
                }
            });
            
            html += `<td class="total-cell">${coloniaData.count}</td>`;
            html += '</tr>';
        });

        return html;
    }

    countByYear(data, year) {
        let count = 0;
        
        if (data.municipios) {
            // Es una zona
            Object.values(data.municipios).forEach(mun => {
                count += this.countByYear(mun, year);
            });
        } else if (data.delitos) {
            // Es un municipio
            Object.values(data.delitos).forEach(del => {
                count += this.countByYear(del, year);
            });
        } else if (data.colonias) {
            // Es un delito
            Object.values(data.colonias).forEach(col => {
                if (col.years[year]) {
                    count += col.years[year].count;
                }
            });
        }
        
        return count;
    }

    countByYearAndMonth(data, year, month) {
        let count = 0;
        
        if (data.municipios) {
            // Es una zona
            Object.values(data.municipios).forEach(mun => {
                count += this.countByYearAndMonth(mun, year, month);
            });
        } else if (data.delitos) {
            // Es un municipio
            Object.values(data.delitos).forEach(del => {
                count += this.countByYearAndMonth(del, year, month);
            });
        } else if (data.colonias) {
            // Es un delito
            Object.values(data.colonias).forEach(col => {
                if (col.years[year] && col.years[year].months[month]) {
                    count += col.years[year].months[month];
                }
            });
        }
        
        return count;
    }

    getYears() {
        const years = new Set();
        this.filteredData.forEach(record => {
            if (record.year) years.add(record.year);
        });
        return Array.from(years).sort();
    }

    sanitizeId(str) {
        return str.toString().replace(/[^a-zA-Z0-9]/g, '_');
    }

    attachExpandListeners() {
        // Listeners para expansión de filas
        const expandButtons = document.querySelectorAll('.expand-btn');
        expandButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetId = btn.getAttribute('data-target');
                this.toggleRows(targetId, btn);
            });
        });

        // Listeners para expansión de columnas (años)
        const yearHeaders = document.querySelectorAll('.year-header');
        yearHeaders.forEach(header => {
            header.addEventListener('click', (e) => {
                const year = header.getAttribute('data-year');
                this.toggleYearColumn(year);
            });
        });
    }

    toggleRows(parentId, button) {
        const childRows = document.querySelectorAll(`tr[data-parent="${parentId}"]`);
        const isExpanded = button.classList.contains('expanded');

        if (isExpanded) {
            // Colapsar
            button.classList.remove('expanded');
            button.classList.add('collapsed');
            childRows.forEach(row => {
                row.classList.add('hidden');
                // También colapsar hijos de estos hijos
                const childBtn = row.querySelector('.expand-btn');
                if (childBtn && childBtn.classList.contains('expanded')) {
                    const childId = childBtn.getAttribute('data-target');
                    this.toggleRows(childId, childBtn);
                }
            });
        } else {
            // Expandir
            button.classList.remove('collapsed');
            button.classList.add('expanded');
            childRows.forEach(row => {
                row.classList.remove('hidden');
            });
        }
    }

    toggleYearColumn(year) {
        // Alternar el estado de expansión del año
        if (this.expandedYears.has(year)) {
            this.expandedYears.delete(year);
        } else {
            this.expandedYears.add(year);
        }
        
        // Re-renderizar la tabla completa
        this.renderTable();
    }
}

// Instancia global del gestor de tabla pivot
let pivotTableManager = null;

// Inicializar la tabla pivot cuando se carguen los datos
function initializePivotTable() {
    if (!pivotTableManager) {
        pivotTableManager = new PivotTableManager();
    }
    
    // Actualizar con los datos actuales
    if (allData && allData.length > 0) {
        pivotTableManager.updateData(allData);
    }
    
    // Inicializar tabla dinámica Pivot (nuevo componente)
    //if (typeof initializePivotTableIntegration === 'function') {
    //    initializePivotTableIntegration();
    //}
}

// Actualizar la tabla pivot cuando cambien los datos o filtros
function updatePivotTable(data) {
    if (pivotTableManager) {
        pivotTableManager.updateData(data || allData);
    }
}

