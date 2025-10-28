package servlet;

import java.io.*;
import javax.servlet.*;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import dao.MovieDAO;
import model.Member;

@WebServlet("/LoginServlet.do")
public class LoginServlet extends HttpServlet {

	@Override
	protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {

		request.setCharacterEncoding("UTF-8");
		response.setContentType("text/html; charset=UTF-8");
		PrintWriter out = response.getWriter();

		String id = request.getParameter("id");
		String password = request.getParameter("password");

		if (id == null || id.trim().isEmpty() || password == null || password.trim().isEmpty()) {
			response.sendRedirect("login.jsp?error=1");
			return;
		}

		MovieDAO dao = new MovieDAO();
		Member member = dao.login(id, password);

		if (member != null) {

			HttpSession session = request.getSession();
			session.setAttribute("member", member);
			session.setAttribute("userId", member.getId());

			out.println("<script>");
			out.println("alert('로그인 성공!');");
			out.println("location.href='index.jsp';");
			out.println("</script>");
		} else {

			response.sendRedirect("login.jsp?error=1");
		}
	}
}
