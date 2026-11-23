package app.cravingcrusher.phone;

import android.app.Activity;
import android.os.Bundle;
import android.util.TypedValue;
import android.widget.ScrollView;
import android.widget.TextView;

/**
 * What Craving Crusher does with Health Connect, in plain words. Health Connect opens this from its permission
 * screen ("Read privacy policy") and from its app settings; Android won't ask for health permissions without it.
 */
public class PrivacyActivity extends Activity {
    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        TextView t = new TextView(this);
        int pad = Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 22, getResources().getDisplayMetrics()));
        t.setPadding(pad, pad * 2, pad, pad);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        t.setLineSpacing(0, 1.25f);
        t.setText("Craving Crusher and Health Connect\n\n"
            + "When you turn on Health Connect in Craving Crusher (Settings → You), it reads your recorded workouts — what kind, "
            + "when, how long — and the active calories each one burned, and adds them to your activity log.\n\n"
            + "It reads nothing else: not your steps, heart rate, weight or any other health data. It writes nothing to "
            + "Health Connect. Your log stays on this phone: Craving Crusher has no internet access and sends nothing anywhere.\n\n"
            + "Turn it off in Craving Crusher, or take its permissions away in Health Connect, at any time. Workouts already "
            + "brought in stay in your log until you delete them.");
        ScrollView s = new ScrollView(this);
        s.addView(t);
        setContentView(s);
    }
}
