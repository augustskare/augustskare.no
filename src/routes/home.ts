import { html } from "remix/html-template";
import { layout } from "../utils/layout";

export default layout(html`
  <h1 class="title">August Skare</h1>
  <p>Frontend developer, living in Tromsø, Norway.</p>

  <section>
    <h2>About</h2>
    <p>
      Making energy-consuming devices talk to each other at
      <a class="enode" href="https://enode.com">Enode</a>.
    </p>
  </section>

  <section>
    <h2>Work experience</h2>
    <ol reversed="reversed">
      <li>
        <article>
          <h3><a href="https://enode.com">Enode</a> <small>Present</small></h3>
          <p>
            <em>Senior software engineer</em>, from
            <time datetime="2021-09">September 2021</time>
            to present
          </p>
        </article>
      </li>
      <li>
        <article>
          <h3>
            <a href="https://bakkenbaeck.com">Bakken & Bæck</a>
            <small>April 2013 - September 2021</small>
          </h3>
          <ol reversed="reversed">
            <li>
              <em>Frontend lead</em>, from
              <time datetime="2018-05">May 2018</time>
              to
              <time datetime="2021-09">September 2021</time>
            </li>
            <li>
              <em>Frontend developer</em>, from
              <time datetime="2013-04">April 2013</time>
              to
              <time datetime="2018-05">May 2018</time>
            </li>
          </ol>
        </article>
      </li>
    </ol>
  </section>

  <section>
    <h2>Education</h2>
    <ol reversed="reversed">
      <li>
        <article>
          <h3>
            Norwegian School of Information Technology
            <small>April 2013 - May 2018</small>
          </h3>
          <p>
            <em>Bachelor’s degree in Computer Science</em>, from
            <time datetime="2013-04">April 2013</time>
            to
            <time datetime="2018-05">May 2018</time>
          </p>
        </article>
      </li>
    </ol>
  </section>

  <section>
    <h2>Contact</h2>
    <address>
      <ul>
        <li><a href="https://github.com/augustskare">GitHub</a></li>
        <li><a href="mailto:post@augustskare.no">Email</a></li>
      </ul>
    </address>
  </section>
`);
