import React, { useState, useEffect } from "react";
import { useLocation, useRoutes, matchRoutes } from "react-router-dom"; 
import { routes } from './routes.jsx';
import "./transitions.css";
import "../utils/animation/animate.css";

export default function AnimatedOutlet() {
    const location = useLocation(); 
    const [displayLocation, setDisplayLocation] = useState(location); 
    const [transitionStage, setTransitionStage] = useState("fadeIn"); 

    const displayedElement = useRoutes(routes, displayLocation);

    useEffect(() => {
        const matches = matchRoutes(routes, displayLocation);
        const title = matches?.[0]?.route?.title
            ? `AP Research Simulation | ${matches[0].route.title}`
            : "AP Research Simulation"
        document.title = title; 
        if (location == displayLocation) return;
        setTransitionStage("fadeOut"); 
    }, [location, displayLocation]); 

    return (
        <>
            <div className={`page-wrapper ${transitionStage}`} onAnimationEnd={() => {
                if (transitionStage === "fadeOut") {
                setDisplayLocation(location);
                setTransitionStage("fadeIn"); 
                }}}
            > 
                {React.cloneElement(displayedElement, { key: displayLocation.pathname })}
            </div>
        </>
    )
}