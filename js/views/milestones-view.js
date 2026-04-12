export function renderMilestonesSection({
  awards,
  puppies,
  isAdmin,
  formatDate,
  escapeHtml
}) {
  const milestoneAwards = awards.filter(item => item.type === "milestone");

  if (milestoneAwards.length === 0) {
    return `
      <div class="card">
        <h2 class="card-title">🎉 Milestones</h2>
        <p class="empty-state">No milestones yet.</p>
      </div>
    `;
  }

  const grouped = puppies.map(puppy => {
    const items = milestoneAwards.filter(item => item.puppyId === puppy.id);
    return { puppy, items };
  }).filter(group => group.items.length > 0);

  return `
    <div class="card">
      <h2 class="card-title">🎉 Milestones</h2>
      <div class="awards-list">
        ${grouped.map(group => `
          <div class="award-puppy-card">
            <div class="award-puppy-header">
              <span class="color-dot" style="background:${group.puppy.color}"></span>
              <div>
                <h3>${group.puppy.name}</h3>
                <div class="award-puppy-sub">${group.puppy.gender}</div>
              </div>
            </div>

            <div class="award-items">
              ${group.items.map(item => {
                const deleteButton = (!item.isAuto && isAdmin)
                  ? `<button class="btn-mini-danger" data-award-id="${item.id}" title="Delete">✕</button>`
                  : "";

                const notesHtml = item.notes
                  ? `<div class="award-notes">${escapeHtml(item.notes)}</div>`
                  : "";

                const autoBadge = item.isAuto
                  ? `<span class="award-badge award-badge-auto">Auto</span>`
                  : "";

                return `
                  <div class="award-item">
                    <div class="award-main">
                      <div class="award-icon">🎉</div>
                      <div>
                        <div class="award-title-line">
                          <span class="award-title">${escapeHtml(item.title)}</span>
                          <span class="award-date">${formatDate(item.date)}</span>
                        </div>
                        ${notesHtml}
                      </div>
                    </div>

                    <div class="award-meta">
                      <span class="award-badge award-badge-milestone">Milestone</span>
                      ${autoBadge}
                      ${deleteButton}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}