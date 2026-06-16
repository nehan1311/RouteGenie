import os

from groq import Groq


def generate_day_report(
    rep_name: str,
    visit_logs: list[dict],
    missed_stores: list[dict],
    rep_dna: dict,
) -> str:
    """
    visit_logs: list of dicts with keys:
    store_name, store_type, outcome, revenue, visited_at, notes

    missed_stores: list of dicts with keys:
    store_name, store_type, urgency_status, reason

    rep_dna: parsed dna_profile dict

    Returns a WhatsApp-ready plain text report string.
    """

    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        raise ValueError(
            "GROQ_API_KEY not found. Make sure your .env file is loaded."
        )

    api_key = api_key.strip()

    client = Groq(api_key=api_key)

    total_revenue = sum(
        v["revenue"]
        for v in visit_logs
        if v.get("outcome") == "sale"
    )

    completed_count = len(visit_logs)
    missed_count = len(missed_stores)

    visits_summary = "\n".join(
        [
            (
                f"- {v['store_name']} ({v['store_type']}): "
                f"{v['outcome']}, "
                f"Rs. {v['revenue']}, "
                f"at {v['visited_at']}"
            )
            for v in visit_logs
        ]
    )

    missed_summary = (
        "\n".join(
            [
                (
                    f"- {m['store_name']} "
                    f"({m['store_type']}, "
                    f"{m['urgency_status']}): "
                    f"{m['reason']}"
                )
                for m in missed_stores
            ]
        )
        if missed_stores
        else "None"
    )

    best_start_time = rep_dna.get(
        "best_time_window_start",
        9,
    )

    prompt = f"""
You are a sales operations assistant.

Generate a concise WhatsApp-ready end-of-day report.

Rep name: {rep_name}
Date: today

Visits completed ({completed_count}):
{visits_summary}

Missed stores ({missed_count}):
{missed_summary}

Total revenue secured: Rs. {total_revenue}

Instructions:
- Keep it under 200 words
- Use WhatsApp formatting with *asterisks*
- Use bullet points starting with -
- Structure:
  1. Greeting
  2. Visits summary
  3. Revenue summary
  4. Missed stores
  5. Tomorrow's priorities
  6. Suggested start time
- Suggested start time should be based on:
  {best_start_time}:00 AM
- Tone should be professional and friendly
- End with a motivational one-liner
- Return plain text only
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        max_tokens=400,
        temperature=0.7,
    )

    return response.choices[0].message.content