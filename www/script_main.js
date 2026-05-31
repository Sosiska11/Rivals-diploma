// ========== script_main.js ==========

document.addEventListener('DOMContentLoaded', function() {
    if (!document.querySelector('.hero')) return;

    // ========== HEADER ==========
    const header = document.getElementById('mainHeader');
    if (header) {
        window.addEventListener('scroll', function() {
            header.classList.toggle('scrolled', window.scrollY > 50);
        });
    }

    // ========== БУРГЕР-МЕНЮ ==========
    const burgerMenu = document.querySelector('.burger-menu');
    const nav = document.querySelector('nav');
    
    if (burgerMenu && nav) {
        burgerMenu.addEventListener('click', function() {
            this.classList.toggle('active');
            nav.classList.toggle('active');
            document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
        });
    }

    // Закрытие меню при клике на ссылки
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (window.innerWidth <= 768 && burgerMenu && nav) {
                burgerMenu.classList.remove('active');
                nav.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });

    // ========== ВИДЕО ФОН ==========
    const heroVideo = document.querySelector('.hero-video');
    if (heroVideo) {
        function tryAutoPlay() {
            const promise = heroVideo.play();
            if (promise !== undefined) {
                promise.catch(() => {
                    heroVideo.style.display = 'none';
                    const hero = document.querySelector('.hero');
                    if (hero) {
                        hero.style.background = 'url("img_main/marvel-rivals-bg.jpg") center/cover';
                    }
                });
            }
        }
        window.addEventListener('load', tryAutoPlay);
    }

    // ========== ТРЕЙЛЕР ==========
    const watchTrailerBtn = document.getElementById('watchTrailer');
    if (watchTrailerBtn) {
        watchTrailerBtn.addEventListener('click', function() {
            const modal = document.createElement('div');
            modal.className = 'video-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.9);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            `;
            
            const video = document.createElement('video');
            video.src = 'img_main/trailer.mp4';
            video.controls = true;
            video.style.cssText = `
                width: 90%;
                max-width: 800px;
                border-radius: 10px;
            `;
            
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                background: #e62429;
                color: white;
                border: none;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                font-size: 24px;
                cursor: pointer;
                z-index: 10001;
            `;
            
            closeBtn.addEventListener('click', function() {
                document.body.removeChild(modal);
                video.pause();
            });
            
            modal.appendChild(video);
            modal.appendChild(closeBtn);
            document.body.appendChild(modal);
            
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    video.pause();
                }
            });
            
            video.play().catch(() => {});
        });
    }

    // ========== ТАЙМЕР ==========
    function updateCountdown() {
        const betaDate = new Date("2026-01-10T00:00:00").getTime();
        const now = new Date().getTime();
        const distance = betaDate - now;
        
        const daysElem = document.getElementById("days");
        const hoursElem = document.getElementById("hours");
        const minutesElem = document.getElementById("minutes");
        const secondsElem = document.getElementById("seconds");
        
        if (daysElem) {
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            daysElem.textContent = days.toString().padStart(2, '0');
        }
        
        if (hoursElem) {
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            hoursElem.textContent = hours.toString().padStart(2, '0');
        }
        
        if (minutesElem) {
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            minutesElem.textContent = minutes.toString().padStart(2, '0');
        }
        
        if (secondsElem) {
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            secondsElem.textContent = seconds.toString().padStart(2, '0');
        }
    }

    const daysElem = document.getElementById("days");
    if (daysElem) {
        setInterval(updateCountdown, 1000);
        updateCountdown();
    }

    // ========== СЛАЙДЕР ==========
    const testimonials = document.querySelectorAll('.testimonial');
    const dots = document.querySelectorAll('.slider-dot');
    
    if (testimonials.length > 0 && dots.length > 0) {
        let currentTestimonial = 0;
        let testimonialInterval;

        function showTestimonial(index) {
            testimonials.forEach(t => {
                t.style.display = 'none';
                t.classList.remove('active');
            });
            
            dots.forEach(d => d.classList.remove('active'));
            
            if (testimonials[index]) {
                testimonials[index].style.display = 'block';
                testimonials[index].classList.add('active');
            }
            
            if (dots[index]) dots[index].classList.add('active');
            currentTestimonial = index;
        }

        function startTestimonialSlider() {
            testimonialInterval = setInterval(() => {
                const nextIndex = (currentTestimonial + 1) % testimonials.length;
                showTestimonial(nextIndex);
            }, 5000);
        }

        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                clearInterval(testimonialInterval);
                showTestimonial(index);
                startTestimonialSlider();
            });
        });

        showTestimonial(0);
        startTestimonialSlider();
    }

    // ========== АНИМАЦИЯ КАРТОЧЕК ==========
    const characterCards = document.querySelectorAll('.character-card');
    if (characterCards.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '50px' });

        characterCards.forEach(card => {
            observer.observe(card);
            
            card.addEventListener('click', function() {
                const characterName = this.querySelector('h3');
                if (characterName) {
                    alert(`Подробнее о ${characterName.textContent} на странице "Герои"`);
                }
            });
        });
    }

    // ========== ФОРМЫ АВТОРИЗАЦИИ (теперь в config.js) ==========
});