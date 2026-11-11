# Data sources

External data used in the simulations (also cited in each simulation's info panel).

| Simulation | Data | Source | Licence / note |
|---|---|---|---|
| b1-heating-curve | c(ice) 2100, c(water) 4180, c(steam) 2000 J kg⁻¹ K⁻¹; L_f 3.34 × 10⁵, L_v 2.26 × 10⁶ J kg⁻¹ | Typical textbook values, CRC Handbook of Chemistry and Physics (rounded) | Physical facts, not copyrightable |
| b1-black-body | CIE 1931 colour-matching functions (analytic multi-lobe fit) | C. Wyman, P.-P. Sloan, P. Shirley, "Simple Analytic Approximations to the CIE XYZ Color Matching Functions", JCGT 2(2), 2013 | Published formulas, own implementation |
| b1-black-body | Approximate effective temperatures: Sun ≈ 5800 K, Sirius A ≈ 9900 K, red dwarf ≈ 3000 K | Rounded literature values (e.g. IAU nominal solar T_eff = 5772 K) | Physical facts |
| b1-calorimetry | c: copper 385, aluminium 900, iron 450, lead 130, water 4180 J kg⁻¹ K⁻¹ | Typical textbook values, CRC Handbook (rounded) | Physical facts |
| b1-conduction | k, ρ, c for copper, aluminium, steel, glass, brick, pine wood, polystyrene foam | Typical room-temperature values, CRC Handbook / engineering tables (rounded) | Physical facts |
| b1-particle-model | Argon Lennard-Jones parameters σ = 3.4 × 10⁻¹⁰ m, ε = 1.65 × 10⁻²¹ J (ε/k_B ≈ 120 K), m = 6.63 × 10⁻²⁶ kg | Standard literature values (e.g. Rahman 1964, Phys. Rev. 136, A405) | Physical facts |
| b2-energy-balance | Solar constant at Mars 586 W m⁻², Venus 2601 W m⁻²; Bond albedo Earth 0.30, Mars 0.25, Venus 0.77; mean surface temperatures 288 K, 210 K, 737 K | NASA Planetary Fact Sheets (nssdc.gsfc.nasa.gov/planetary/factsheet) | US government work, public domain |
| b3-gas-container | Kinetic diameters He 0.26, Ne 0.275, Ar 0.34, Xe 0.396 nm; atomic masses | D. W. Breck, Zeolite Molecular Sieves (Wiley, 1974); IUPAC standard atomic weights | Physical facts |
| b3-gas-laws | van der Waals constants a, b for He, N₂, CO₂ | CRC Handbook of Chemistry and Physics (converted to SI) | Physical facts |
| b5-resistivity | Resistivities at 20 °C: Cu 1.68 × 10⁻⁸, Al 2.65 × 10⁻⁸, W 5.6 × 10⁻⁸, Fe 9.7 × 10⁻⁸, constantan 4.9 × 10⁻⁷, nichrome 1.1 × 10⁻⁶ Ω m | CRC Handbook of Chemistry and Physics (typical values) | Physical facts |
| d1-orbits, d1-escape-velocity | Solar mass 1.989 × 10³⁰ kg; Earth mass 5.97 × 10²⁴ kg, radius 6.37 × 10⁶ m | IAU nominal values; NASA Earth Fact Sheet | Physical facts |
| d2-millikan | Oil density 875 kg m⁻³, air density 1.2 kg m⁻³, air viscosity 1.81 × 10⁻⁵ Pa s | Typical textbook values (CRC Handbook) | Physical facts |
| e1-spectra | Wavelengths (air) of strong visible lines of H, He, Hg, Na, Ne; relative intensities approximate | NIST Atomic Spectra Database (physics.nist.gov/asd), strong-lines tables | US government work, public domain |
| e1-spectra | Air refractive index | B. Edlén, Metrologia 2, 71 (1966) | Published formula |
| e2-photoelectric | Work functions: Cs 2.1, K 2.3, Na 2.4, Ca 2.9, Zn 4.3, Cu 4.7, Pt 5.6 eV (rounded, polycrystalline) | CRC Handbook of Chemistry and Physics, "Electron work function of the elements" (typical values) | Physical facts |
| e2-de-broglie | Graphite plane spacings 0.213 nm and 0.123 nm; double-slit geometry (slits 62 nm wide, 272 nm apart, 600 eV electrons) | Standard school electron-diffraction tube values; R. Bach et al., "Controlled double-slit electron diffraction", New J. Phys. 15, 033018 (2013) | Physical facts |
| e3-decay | Half-lives: Rn-220 55.6 s, Ba-137m 2.55 min, I-131 8.02 d, Co-60 5.27 y, C-14 5700 y | NUBASE2020 (F. G. Kondev et al., Chinese Phys. C 45, 030001, 2021), rounded | Physical facts |
| e3-penetration | γ mass attenuation at 1.25 MeV: Pb 0.059, Al 0.055 cm² g⁻¹; α range rule R = 0.318 E^1.5 cm; β range and absorption (Katz–Penfold); Sr-90/Y-90 end points 0.546/2.28 MeV | NIST XCOM (physics.nist.gov/xcom); L. Katz & A. S. Penfold, Rev. Mod. Phys. 24, 28 (1952); NNDC decay data | US government work / published formulas |
| e5-parallax | Parallaxes: Proxima Centauri 0.768″, Barnard's Star 0.547″, Sirius 0.379″, Vega 0.130″, Polaris 0.0075″; approximate ecliptic latitudes | Gaia DR3 and Hipparcos (van Leeuwen 2007) via SIMBAD, rounded | Physical facts |
| e5-luminosity | Sun R = 6.96 × 10⁸ m, T = 5772 K; Proxima Centauri, Sirius A, Vega, Betelgeuse radii, temperatures and distances (rounded) | IAU 2015 Resolution B3 nominal solar values; literature values via SIMBAD (rounded) | Physical facts |
| e5-fusion | Atomic masses ¹H 1.00782503, ²H 2.01410178, ³He 3.01602932, ⁴He 4.00260325 u | AME2020 (M. Wang et al., Chinese Phys. C 45, 030003, 2021) | Physical facts |
| e3-binding-energy | Mass excesses and binding energies per nucleon of 2550 measured nuclides (`src/data/ame2020.ts`, extracted with `scripts/extract-data.py`) | AME2020: M. Wang et al., Chinese Phys. C 45, 030003 (2021), www-nds.iaea.org/amdc | CC BY 3.0 (open-access article data); cited |
| e3-nuclide-chart | Half-lives and main decay modes of 3558 ground-state nuclides (`src/data/nubase2020.ts`) | NUBASE2020: F. G. Kondev et al., Chinese Phys. C 45, 030001 (2021), www-nds.iaea.org/amdc | CC BY 3.0 (open-access article data); cited |
| e5-hr-diagram | 6054 stars: name, visual luminosity, B−V, distance, V magnitude, spectral type (`src/data/hyg.ts`; V ≤ 6.0 within 500 pc, plus all stars within 20 pc) | HYG database v4.1, D. Nash, github.com/astronexus/HYG-Database (compiled from Hipparcos, Yale Bright Star and Gliese catalogues); temperature from B−V: L. Ballesteros, EPL 97, 34008 (2012) | **CC BY-SA 4.0** — the derived subset `src/data/hyg.ts` is shared under the same licence |
