/**
 * WorldBonus - State machine for the roulette world bonus system.
 *
 * Phases:
 *   countdown  – 90-second timer ticking down
 *   spinning   – game paused, wheel spinning with ease-out
 *   reveal     – wheel stopped, result displayed for 3 seconds
 *   active     – bonus effect in play (Wind/Earth/Freeze/Fire) with its own timer
 *
 * Boss is a special case: after reveal it immediately resumes normal play
 * and resets the countdown.
 */

const BONUS_TYPES = [
    { id: 'wind',   label: 'Wind',   color: '#7ec8e3', icon: '🌬️' },
    { id: 'earth',  label: 'Earth',  color: '#a0785a', icon: '🪨' },
    { id: 'freeze', label: 'Freeze', color: '#4466cc', icon: '❄️' },
    { id: 'fire',   label: 'Fire',   color: '#e85d26', icon: '🔥' },
    { id: 'boss',   label: 'Boss',   color: '#6b2fa0', icon: '💀' },
];

const COUNTDOWN_DURATION = 90;     // seconds between spins
const BONUS_DURATION = 15;         // seconds for Wind / Earth / Freeze / Fire
const SPIN_DURATION = 3.5;         // seconds the wheel spins
const REVEAL_DURATION = 3;         // seconds the result is shown before activation
const WEDGE_ANGLE = (Math.PI * 2) / BONUS_TYPES.length; // 72°

export default class WorldBonus {
    constructor() {
        this.phase = 'countdown'; // countdown | spinning | reveal | active
        this.countdownTimer = COUNTDOWN_DURATION;
        this.activeBonus = null;       // string id or null
        this.bonusTimer = 0;

        // Spin animation state
        this.spinElapsed = 0;
        this.spinTotalRotation = 0;    // total radians the wheel will rotate
        this.spinCurrentAngle = 0;     // current rotation of the wheel
        this.selectedIndex = -1;       // index into BONUS_TYPES

        // Reveal timer
        this.revealElapsed = 0;
    }

    /* ------------------------------------------------------------------ */
    /*  Public helpers                                                     */
    /* ------------------------------------------------------------------ */

    /** Should the normal game update be skipped this frame? */
    get isPausing() {
        return this.phase === 'spinning' || this.phase === 'reveal';
    }

    /** Is a bonus currently active (not boss)? */
    get isBonusActive() {
        return this.phase === 'active' && this.activeBonus !== 'boss';
    }

    /** Reset everything (new game / game-over). */
    reset() {
        this.phase = 'countdown';
        this.countdownTimer = COUNTDOWN_DURATION;
        this.activeBonus = null;
        this.bonusTimer = 0;
        this.spinElapsed = 0;
        this.spinTotalRotation = 0;
        this.spinCurrentAngle = 0;
        this.selectedIndex = -1;
        this.revealElapsed = 0;
    }

    /* ------------------------------------------------------------------ */
    /*  Update (called every frame from game.js)                          */
    /* ------------------------------------------------------------------ */

    /**
     * @param {number} dt – deltaTime in seconds
     * @returns {{ event: string|null, bonus: string|null }}
     *   Possible events:
     *     'spinStart'      – wheel just started spinning
     *     'bonusActivated' – bonus was just activated this frame
     *     'bonusEnded'     – bonus just ended this frame
     */
    update(dt) {
        const result = { event: null, bonus: null };

        switch (this.phase) {
            case 'countdown':
                this.countdownTimer -= dt;
                if (this.countdownTimer <= 0) {
                    this.countdownTimer = 0;
                    this._startSpin();
                    result.event = 'spinStart';
                }
                break;

            case 'spinning':
                this.spinElapsed += dt;
                if (this.spinElapsed >= SPIN_DURATION) {
                    this.spinElapsed = SPIN_DURATION;
                    this.phase = 'reveal';
                    this.revealElapsed = 0;
                }
                // Update current angle with ease-out
                this.spinCurrentAngle = this._easeOutAngle();
                break;

            case 'reveal':
                this.revealElapsed += dt;
                if (this.revealElapsed >= REVEAL_DURATION) {
                    this._activateBonus();
                    result.event = 'bonusActivated';
                    result.bonus = this.activeBonus;
                }
                break;

            case 'active':
                if (this.activeBonus === 'boss') {
                    // Boss has no timed bonus – immediately restart countdown
                    this.phase = 'countdown';
                    this.countdownTimer = COUNTDOWN_DURATION;
                    this.activeBonus = null;
                } else {
                    this.bonusTimer -= dt;
                    if (this.bonusTimer <= 0) {
                        result.event = 'bonusEnded';
                        result.bonus = this.activeBonus;
                        this.activeBonus = null;
                        this.phase = 'countdown';
                        this.countdownTimer = COUNTDOWN_DURATION;
                    }
                }
                break;
        }

        return result;
    }

    /* ------------------------------------------------------------------ */
    /*  Draw (called every frame AFTER the game scene is drawn)           */
    /* ------------------------------------------------------------------ */

    draw(ctx, canvas) {
        if (this.phase !== 'spinning' && this.phase !== 'reveal') return;

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = Math.min(canvas.width, canvas.height) * 0.25;

        // Semi-translucent overlay
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // --- Draw wheel ---
        ctx.translate(cx, cy);

        const angle = this.phase === 'reveal'
            ? this._easeOutAngle()   // frozen at final angle
            : this.spinCurrentAngle;

        ctx.save();
        ctx.rotate(angle);

        for (let i = 0; i < BONUS_TYPES.length; i++) {
            const startA = i * WEDGE_ANGLE;
            const endA = startA + WEDGE_ANGLE;

            // Wedge fill
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, startA, endA);
            ctx.closePath();
            ctx.fillStyle = BONUS_TYPES[i].color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.stroke();

            // Label + icon
            const midAngle = startA + WEDGE_ANGLE / 2;
            const labelR = radius * 0.62;
            ctx.save();
            ctx.translate(Math.cos(midAngle) * labelR, Math.sin(midAngle) * labelR);
            ctx.rotate(midAngle + Math.PI / 2);
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.floor(radius * 0.12)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(BONUS_TYPES[i].label, 0, -radius * 0.06);
            ctx.font = `${Math.floor(radius * 0.18)}px Arial`;
            ctx.fillText(BONUS_TYPES[i].icon, 0, radius * 0.08);
            ctx.restore();
        }

        ctx.restore(); // un-rotate

        // --- Pointer (triangle at top) ---
        const pSize = radius * 0.1;
        ctx.beginPath();
        ctx.moveTo(0, -radius - pSize * 1.5);
        ctx.lineTo(-pSize, -radius - pSize * 3);
        ctx.lineTo(pSize, -radius - pSize * 3);
        ctx.closePath();
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();

        // --- Reveal text ---
        if (this.phase === 'reveal' && this.selectedIndex >= 0) {
            const bonus = BONUS_TYPES[this.selectedIndex];
            const pulse = 1 + 0.05 * Math.sin(performance.now() / 200);
            ctx.save();
            ctx.scale(pulse, pulse);
            ctx.font = `bold ${Math.floor(radius * 0.28)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'white';
            ctx.shadowColor = bonus.color;
            ctx.shadowBlur = 30;
            ctx.fillText(`${bonus.icon} ${bonus.label} ${bonus.icon}`, 0, radius + radius * 0.4);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Center circle decoration
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.12, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'white';
        ctx.stroke();

        ctx.restore(); // un-translate + global save
    }

    /* ------------------------------------------------------------------ */
    /*  Private helpers                                                    */
    /* ------------------------------------------------------------------ */

    _startSpin() {
        this.phase = 'spinning';
        this.spinElapsed = 0;

        // Pick the result ahead of time
        this.selectedIndex = Math.floor(Math.random() * BONUS_TYPES.length);

        // We want the pointer (at -PI/2, i.e. top of circle) to land in the
        // middle of the selected wedge.  The wedge center (un-rotated) is at:
        //   selectedIndex * WEDGE_ANGLE + WEDGE_ANGLE/2
        // The pointer is at angle -PI/2.  So the wheel must end rotated such
        // that:  -(endAngle + wedgeCenter) ≡ -PI/2  (mod 2PI)
        // endAngle = PI/2 - wedgeCenter + N*2PI   (N full rotations for drama)
        const wedgeCenter = this.selectedIndex * WEDGE_ANGLE + WEDGE_ANGLE / 2;
        const extraRotations = 5 + Math.floor(Math.random() * 3); // 5-7 full spins
        this.spinTotalRotation = -(Math.PI / 2 + wedgeCenter) + extraRotations * Math.PI * 2;
    }

    /** Ease-out cubic for the spin. */
    _easeOutAngle() {
        const t = Math.min(this.spinElapsed / SPIN_DURATION, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        return this.spinTotalRotation * eased;
    }

    _activateBonus() {
        const bonus = BONUS_TYPES[this.selectedIndex];
        this.activeBonus = bonus.id;

        if (bonus.id === 'boss') {
            this.phase = 'active'; // will immediately transition to countdown in next update
            this.bonusTimer = 0;
        } else {
            this.phase = 'active';
            this.bonusTimer = BONUS_DURATION;
        }
    }
}

export { BONUS_TYPES, COUNTDOWN_DURATION, BONUS_DURATION };
