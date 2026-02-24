const resumeData = {
    education: "UT Austin: BS CS (Honors) & BBA (Business Honors) [2027]",
    skills: ["C/C++", "Rust", "Python", "CUDA", "PyTorch", "LLVM", "Docker"], 
    experience: [
        {
            title: "SWE Intern @ Students Teaching Finance",
            desc: "Optimized P99 latency by 60ms for 4,000+ users." 
        },
        {
            title: "Research Assistant @ UC Berkeley",
            desc: "Developed transformer-based NLP for legal texts (89% accuracy)." 
        }
    ],
    projects: [
        { name: "HastOS", desc: "AOT compiler for Java subset targeting x86-64 SIMD." }, 
        { name: "Hastorium", desc: "Low-latency F1 telemetry engine in C++." } 
    ],
    awards: [
        "ACSL 1st Place", 
        "USACO Platinum Division",
        "ICPC SCUSA 7th Place" 
    ]
};

// Populate Education
document.getElementById('education').innerHTML += `<p>${resumeData.education}</p>`;

// Populate Skills
const skillsContainer = document.getElementById('skills-tags');
resumeData.skills.forEach(skill => {
    skillsContainer.innerHTML += `<span class="tag">${skill}</span>`;
});

// Populate Experience
const expContainer = document.getElementById('experience-list');
resumeData.experience.forEach(exp => {
    expContainer.innerHTML += `<div><h4>${exp.title}</h4><p>${exp.desc}</p></div>`;
});

// Populate Projects
const projContainer = document.getElementById('projects-list');
resumeData.projects.forEach(proj => {
    projContainer.innerHTML += `<div><h4>${proj.name}</h4><p>${proj.desc}</p></div>`;
});

// Populate Awards
const awardsList = document.getElementById('awards-list');
resumeData.awards.forEach(award => {
    awardsList.innerHTML += `<li>${award}</li>`;
});
