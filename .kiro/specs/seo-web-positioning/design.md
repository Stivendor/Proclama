# Design Document — seo-web-positioning

## Overview

Este documento describe la arquitectura técnica para implementar las mejoras de SEO y posicionamiento web en Proclama, una SPA React 18 + TypeScript + Vite 6 desplegada en Vercel.

El objetivo central es maximizar la visibilidad orgánica de la landing page (`LandingView.tsx`) en buscadores, mejorar las previsualizaciones en redes sociales y garantizar que el contenido sea indexable sin depender de la ejecución de JavaScript en el cliente.

El stack no incluye router tradicional. La navegación se gestiona con estado Zustand (`activeView`). La landing page es la única vis