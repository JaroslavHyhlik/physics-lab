# IB Physics reference for implementation

Our own condensed summary of the **Physics data booklet, first assessment 2025 (v1.2)** for
building simulations: constants, symbols and which equations are SL vs. additional HL.
The original PDF lives in `reference/` (git-ignored, © IBO) — read it only if this file is unclear.

## Constants (use exactly these in `src/core/constants.ts`)

| Quantity | Symbol | Value |
|---|---|---|
| Acceleration of free fall (Earth's surface) | g | 9.8 m s⁻² |
| Gravitational constant | G | 6.67 × 10⁻¹¹ N m² kg⁻² |
| Avogadro constant | N_A | 6.02 × 10²³ mol⁻¹ |
| Gas constant | R | 8.31 J K⁻¹ mol⁻¹ |
| Boltzmann constant | k_B | 1.38 × 10⁻²³ J K⁻¹ |
| Stefan–Boltzmann constant | σ | 5.67 × 10⁻⁸ W m⁻² K⁻⁴ |
| Coulomb constant | k | 8.99 × 10⁹ N m² C⁻² |
| Permittivity of free space | ε₀ | 8.85 × 10⁻¹² C² N⁻¹ m⁻² |
| Permeability of free space | μ₀ | 4π × 10⁻⁷ T m A⁻¹ |
| Speed of light in vacuum | c | 3.00 × 10⁸ m s⁻¹ |
| Planck constant | h | 6.63 × 10⁻³⁴ J s |
| Elementary charge | e | 1.60 × 10⁻¹⁹ C |
| Electron rest mass | m_e | 9.110 × 10⁻³¹ kg = 0.000549 u = 0.511 MeV c⁻² |
| Proton rest mass | m_p | 1.673 × 10⁻²⁷ kg = 1.007276 u = 938 MeV c⁻² |
| Neutron rest mass | m_n | 1.675 × 10⁻²⁷ kg = 1.008665 u = 940 MeV c⁻² |
| Unified atomic mass unit | u | 1.661 × 10⁻²⁷ kg = 931.5 MeV c⁻² |
| Solar constant | S | 1.36 × 10³ W m⁻² |
| Fermi radius | R₀ | 1.20 × 10⁻¹⁵ m |

Conversions: 1 ly = 9.46 × 10¹⁵ m · 1 pc = 3.26 ly · 1 AU = 1.50 × 10¹¹ m ·
1 kWh = 3.60 × 10⁶ J · hc = 1.99 × 10⁻²⁵ J m = 1.24 × 10⁻⁶ eV m · T(K) = θ(°C) + 273.

Booklet note: all equations are magnitudes only (no vector notation).
Uncertainty rules: Δy = Δa + Δb for sums; Δy/y = Δa/a + Δb/b + Δc/c for products/quotients; Δy/y = |n|Δa/a for powers.

## Symbols to use in the UI (booklet notation)

- Kinematics: s displacement, u initial velocity, v final velocity, a, t.
- Friction: F_f ≤ μ_s F_N (static), F_f = μ_d F_N (**dynamic**, not "kinetic").
- Forces: F_H = −kx (Hooke), F_d = 6πηrv (Stokes drag), F_b = ρVg (buoyancy), F_g = mg, J = FΔt impulse.
- Energy: E_k, E_p (gravitational, ΔE_p = mgΔh), E_H = ½kΔx² (elastic), η efficiency.
- Rotation (HL): τ, θ, ω, α, I, L.
- Thermal: Q, c, L (latent heat), k (thermal conductivity), L (luminosity), b (apparent brightness), U internal energy.
- Gases: P pressure, V, n, N, T.
- Circuits: I, V, R, ρ (resistivity), ε emf, r internal resistance.
- SHM/waves: x, x₀, ω, φ, T, f, λ, v; s fringe spacing, D, d slit separation, b slit width.
- Fields: g, G, M, V_g (HL); k, q, Q, E, V_e (HL); B, Φ flux, N turns.
- Quantum (HL): Φ work function, λ, p.
Symbols are reused (L, k, b, Φ, ρ) — always show the quantity name next to the symbol.

## Equations: SL and HL by topic

**A.1 (SL)** s = (u + v)t/2 · v = u + at · s = ut + ½at² · v² = u² + 2as

**A.2 (SL)** F_f ≤ μ_s F_N · F_f = μ_d F_N · F_H = −kx · F_d = 6πηrv · F_b = ρVg · F_g = mg ·
p = mv · J = FΔt · F = ma = Δp/Δt · a = v²/r = ω²r = 4π²r/T² · v = 2πr/T = ωr

**A.3 (SL)** W = Fs cosθ · E_k = ½mv² = p²/(2m) · ΔE_p = mgΔh · E_H = ½kΔx² ·
P = ΔW/Δt = Fv · η = useful work out / total work in = useful power out / total power in

**A.4 (HL only)** τ = Fr sinθ · Δθ = (ω_f + ω_i)t/2 · ω_f = ω_i + αt · Δθ = ω_i t + ½αt² ·
ω_f² = ω_i² + 2αΔθ · I = Σmr² · τ = Iα · L = Iω · ΔL = τΔt · ΔL = Δ(Iω) · E_k = ½Iω² = L²/(2I)

**A.5 (HL only)** x′ = x − vt · t′ = t · u′ = u − v · x′ = γ(x − vt) · t′ = γ(t − vx/c²) ·
γ = 1/√(1 − v²/c²) · u′ = (u − v)/(1 − uv/c²) · (ct′)² − (x′)² = (ct)² − x² (interval s²) ·
Δt = γΔt₀ · L = L₀/γ · tanθ = v/c (spacetime diagram axes)

**B.1 (SL)** ρ = m/V · E_k = (3/2)k_B T · Q = mcΔT · Q = mL · ΔQ/Δt = kAΔT/Δx ·
L = σAT⁴ · b = L/(4πd²) · λ_max T = 2.9 × 10⁻³ m K

**B.2 (SL)** emissivity = power radiated per unit area / σT⁴ · albedo = total scattered power / total incident power

**B.3 (SL)** n = N/N_A · P = F/A · PV/T = constant · PV = nRT = Nk_B T · P = ⅓ρv̄² (mean square speed) ·
U = (3/2)nRT = (3/2)Nk_B T

**B.4 (HL only)** Q = ΔU + W · W = PΔV · ΔU = (3/2)nRΔT = (3/2)Nk_BΔT · ΔS = ΔQ/T · S = k_B ln Ω ·
PV^(5/3) = constant (adiabatic, monatomic) · η = useful work / input energy · η_Carnot = 1 − T_c/T_h

**B.5 (SL)** I = Δq/Δt · V = W/q · R = V/I · ρ = RA/L · P = VI = I²R = V²/R ·
series: I equal, V = V₁ + V₂ …, R_s = R₁ + R₂ … · parallel: I = I₁ + I₂ …, V equal, 1/R_p = 1/R₁ + 1/R₂ … ·
ε = I(R + r)

**C.1 (SL)** a = −ω²x · T = 1/f = 2π/ω · T = 2π√(m/k) · T = 2π√(l/g)
**C.1 (HL)** x = x₀ sin(ωt + φ) · v = ωx₀ cos(ωt + φ) · v = ±ω√(x₀² − x²) · E_T = ½mω²x₀² · E_p = ½mω²x²

**C.2 (SL)** v = fλ = λ/T

**C.3 (SL)** n₁/n₂ = sinθ₂/sinθ₁ = v₂/v₁ · constructive: path difference = nλ · destructive: (n + ½)λ · s = λD/d
**C.3 (HL)** θ = λ/b (single slit, first minimum) · nλ = d sinθ (grating)

**C.4** no equations in booklet (standing waves, resonance — SL).

**C.5 (SL)** Δf/f = Δλ/λ ≈ v/c
**C.5 (HL)** moving source f′ = f·v/(v ± u_s) · moving observer f′ = f·(v ± u_o)/v

**D.1 (SL)** F = Gm₁m₂/r² · g = F/m = GM/r²
**D.1 (HL)** g = −ΔV_g/Δr · W = mΔV_g · E_p = −Gm₁m₂/r · V_g = −GM/r · v_esc = √(2GM/r) · v_orbital = √(GM/r)

**D.2 (SL)** F = kq₁q₂/r², k = 1/(4πε₀) · E = F/q · E = V/d
**D.2 (HL)** E_p = kq₁q₂/r · V_e = kQ/r · E = −ΔV_e/Δr · W = qΔV_e

**D.3 (SL)** F = qvB sinθ · F = BIL sinθ · F/L = μ₀I₁I₂/(2πr)

**D.4 (HL only)** Φ = BA cosθ · ε = −NΔΦ/Δt · ε = BvL

**E.1 (SL)** E = hf
**E.1 (HL)** R = R₀A^(1/3) · E = −13.6/n² eV · mvr = nh/(2π)

**E.2 (HL only)** E_max = hf − Φ · λ = h/p · λ_f − λ_i = Δλ = h/(m_e c)·(1 − cosθ)

**E.3 (SL)** E = mc²
**E.3 (HL)** N = N₀e^(−λt) · A = λN = λN₀e^(−λt) · T½ = ln2/λ

**E.4** no equations in booklet (SL).

**E.5 (SL)** d (parsec) = 1/p (arc-second) — plus L = σAT⁴ and b = L/(4πd²) from B.1

## Not in the 2025 syllabus (don't present as syllabus content)
Capacitance/RC circuits, transformers, polarisation/Malus's law, Hubble's law, van der Waals gas.
If included as an extra, label it "Beyond syllabus".
