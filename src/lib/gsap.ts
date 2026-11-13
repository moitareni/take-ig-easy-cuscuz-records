import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Flip } from 'gsap/Flip';

// Registra os plugins uma única vez no carregamento do módulo (regra gsap-react / gsap-plugins).
gsap.registerPlugin(useGSAP, Flip);

export { gsap, useGSAP, Flip };
